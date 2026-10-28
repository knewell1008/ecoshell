import {json} from './lib/supabase.js';
import {productSlug, productPage} from './lib/storyblok.js';
import {enquiriesCreate} from './api/enquiries.js';
import {adminOverview} from './api/adminOverview.js';
import {adminProjectsUpdate} from './api/adminProjects.js';
import {login} from './api/login.js';
import {clientProjects} from './api/clientProjects.js';
import {profileGet, profileUpdate} from './api/profile.js';
import {countriesList} from './api/countries.js';
import {
  industriesList, archetypesList, industryCreate, archetypeCreate, industryDelete, archetypeDelete,
  polymersList, processesList, polymerCreate, processCreate, polymerDelete, processDelete
} from './api/lists.js';
import {opportunityDetail} from './api/adminOpportunity.js';
import {companiesImport} from './api/companiesImport.js';
import {clientMessageCreate, adminMessageCreate} from './api/messages.js';
import {clientDocumentUpload} from './api/clientRecords.js';
import {
  opportunityCreate,
  sampleCreate,
  pilotCreate,
  pilotResultCreate,
  proposalCreate,
  contractCreate,
  documentCreate,
  documentUpload,
  sampleUpdate,
  pilotUpdate,
  pilotResultUpdate,
  proposalUpdate,
  contractUpdate,
  documentUpdate,
  noteUpdate,
  clientUpdateEdit,
  companyCreate,
  companyUpdate,
  contactCreate,
  clientUpdate
} from './api/adminRecords.js';

const routes = [
  {method: 'POST', path: '/api/enquiries', handler: enquiriesCreate},
  {method: 'GET', path: '/api/admin/overview', handler: adminOverview},
  {method: 'GET', path: '/api/admin/opportunity', handler: opportunityDetail},
  {method: 'PATCH', path: '/api/admin/projects', handler: adminProjectsUpdate},
  {method: 'POST', path: '/api/admin/opportunities', handler: opportunityCreate},
  {method: 'POST', path: '/api/admin/samples', handler: sampleCreate},
  {method: 'POST', path: '/api/admin/pilots', handler: pilotCreate},
  {method: 'POST', path: '/api/admin/pilot-results', handler: pilotResultCreate},
  {method: 'POST', path: '/api/admin/proposals', handler: proposalCreate},
  {method: 'POST', path: '/api/admin/contracts', handler: contractCreate},
  {method: 'POST', path: '/api/admin/documents', handler: documentCreate},
  {method: 'POST', path: '/api/admin/documents/upload', handler: documentUpload},
  {method: 'PATCH', path: '/api/admin/samples', handler: sampleUpdate},
  {method: 'PATCH', path: '/api/admin/pilots', handler: pilotUpdate},
  {method: 'PATCH', path: '/api/admin/pilot-results', handler: pilotResultUpdate},
  {method: 'PATCH', path: '/api/admin/proposals', handler: proposalUpdate},
  {method: 'PATCH', path: '/api/admin/contracts', handler: contractUpdate},
  {method: 'PATCH', path: '/api/admin/documents', handler: documentUpdate},
  {method: 'PATCH', path: '/api/admin/notes', handler: noteUpdate},
  {method: 'PATCH', path: '/api/admin/updates', handler: clientUpdateEdit},
  {method: 'POST', path: '/api/admin/companies/import', handler: companiesImport},
  {method: 'POST', path: '/api/admin/companies', handler: companyCreate},
  {method: 'PATCH', path: '/api/admin/companies', handler: companyUpdate},
  {method: 'POST', path: '/api/admin/contacts', handler: contactCreate},
  {method: 'PATCH', path: '/api/admin/clients', handler: clientUpdate},
  {method: 'POST', path: '/api/login', handler: login},
  {method: 'GET', path: '/api/client/projects', handler: clientProjects},
  {method: 'POST', path: '/api/client/messages', handler: clientMessageCreate},
  {method: 'POST', path: '/api/client/documents/upload', handler: clientDocumentUpload},
  {method: 'POST', path: '/api/admin/messages', handler: adminMessageCreate},
  {method: 'GET', path: '/api/profile', handler: profileGet},
  {method: 'PATCH', path: '/api/profile', handler: profileUpdate},
  {method: 'GET', path: '/api/countries', handler: countriesList},
  {method: 'GET', path: '/api/industries', handler: industriesList},
  {method: 'GET', path: '/api/archetypes', handler: archetypesList},
  {method: 'POST', path: '/api/admin/industries', handler: industryCreate},
  {method: 'POST', path: '/api/admin/archetypes', handler: archetypeCreate},
  {method: 'DELETE', path: '/api/admin/industries', handler: industryDelete},
  {method: 'DELETE', path: '/api/admin/archetypes', handler: archetypeDelete},
  {method: 'GET', path: '/api/polymers', handler: polymersList},
  {method: 'GET', path: '/api/processes', handler: processesList},
  {method: 'POST', path: '/api/admin/polymers', handler: polymerCreate},
  {method: 'POST', path: '/api/admin/processes', handler: processCreate},
  {method: 'DELETE', path: '/api/admin/polymers', handler: polymerDelete},
  {method: 'DELETE', path: '/api/admin/processes', handler: processDelete}
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const route = routes.find((r) => r.method === request.method && r.path === url.pathname);
      if (!route) return json({error: 'Not found.'}, {status: 404});
      try {
        return await route.handler({request, env, ctx});
      } catch (error) {
        return json({error: error.message}, {status: 500});
      }
    }

    const slug = productSlug(url);
    if (slug) return productPage(request, env, slug);

    return env.ASSETS.fetch(request);
  }
};
