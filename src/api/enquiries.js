import {cleanString, json, requireEnv, supabaseFetch} from '../lib/supabase.js';
import {findOrCreateCompany} from '../lib/companies.js';
import {sendEmail, enquiryEmail} from '../lib/email.js';

export async function enquiriesCreate({request, env, ctx}) {
  const envError = requireEnv(env, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (envError) return json({error: envError}, {status: 500});

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({error: 'Invalid JSON body.'}, {status: 400});
  }

  const enquiry = {
    first_name: cleanString(payload.first_name),
    last_name: cleanString(payload.last_name),
    company: cleanString(payload.company),
    email: cleanString(payload.email).toLowerCase(),
    country: cleanString(payload.country),
    application: cleanString(payload.application),
    message: cleanString(payload.message)
  };

  if (!enquiry.email || !enquiry.company || !enquiry.message) {
    return json({error: 'Company, email and project details are required.'}, {status: 400});
  }

  try {
    const companyId = await findOrCreateCompany(env, enquiry.company, {country: enquiry.country || null});

    const existing = await supabaseFetch(env, `users?email=eq.${encodeURIComponent(enquiry.email)}&select=id,company_id`);
    let userId = existing[0]?.id;

    if (!userId) {
      const name = [enquiry.first_name, enquiry.last_name].filter(Boolean).join(' ');
      const inserted = await supabaseFetch(env, 'users?select=id', {
        method: 'POST',
        headers: {prefer: 'return=representation'},
        body: JSON.stringify({
          email: enquiry.email,
          role: 'member',
          status: 'lead',
          name: name || null,
          company_id: companyId,
          company_name: enquiry.company,
          country: enquiry.country || null
        })
      });
      userId = inserted[0].id;
    } else if (!existing[0].company_id) {
      // Existing contact with no company linked yet (e.g. self-signed-up before enquiring) -- link them now.
      await supabaseFetch(env, `users?id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({company_id: companyId, company_name: enquiry.company})
      });
    }

    const insertedEnquiry = await supabaseFetch(env, 'enquiries?select=id', {
      method: 'POST',
      headers: {prefer: 'return=representation'},
      body: JSON.stringify({...enquiry, user_id: userId, company_id: companyId, status: 'new'})
    });

    const project = await supabaseFetch(env, 'projects?select=id,reference_code', {
      method: 'POST',
      headers: {prefer: 'return=representation'},
      body: JSON.stringify({
        company_id: companyId,
        contact_id: userId,
        enquiry_id: insertedEnquiry[0].id,
        name: `${enquiry.application || 'Material'} review for ${enquiry.company}`,
        polymer: null,
        process: enquiry.application,
        status: 'new_inquiry',
        target: enquiry.message
      })
    });

    await supabaseFetch(env, 'project_updates', {
      method: 'POST',
      body: JSON.stringify({
        project_id: project[0].id,
        audience: 'client',
        body: 'Your inquiry has been received. Ecoshell will review the application, polymer and mandate details next.',
        created_by: 'system'
      })
    });

    // Tell the team by email. Sent after the response, and a failure here never loses the inquiry.
    const mail = enquiryEmail(enquiry, {reference: project[0].reference_code, adminUrl: new URL('/admin', request.url).href});
    ctx.waitUntil(sendEmail(env, {to: env.ENQUIRY_EMAIL_TO, ...mail}).catch((error) => console.error('Inquiry email failed:', error.message)));

    return json({
      ok: true,
      enquiry_id: insertedEnquiry[0].id,
      project_id: project[0].id,
      reference_code: project[0].reference_code
    });
  } catch (error) {
    return json({error: error.message}, {status: 500});
  }
}
