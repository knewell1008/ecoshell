// Ecoshell public site: side-rail menus, phone menu, home banner, contact type picker and enquiry forms.
(function(){
  var panel = document.getElementById('panel');
  var openKey = null;

  function setRail(key){
    document.querySelectorAll('.rbtn[data-panel]').forEach(function(b){
      b.setAttribute('aria-expanded', b.dataset.panel === key ? 'true' : 'false');
    });
  }
  function closePanel(){
    openKey = null;
    if(panel) panel.hidden = true;
    setRail(null);
  }
  function openPanel(key){
    if(openKey === key){ closePanel(); return; }
    openKey = key;
    panel.querySelectorAll('[data-pane]').forEach(function(p){ p.hidden = p.dataset.pane !== key; });
    panel.hidden = false;
    setRail(key);
  }
  document.querySelectorAll('.rbtn[data-panel]').forEach(function(b){
    b.addEventListener('click', function(){ openPanel(b.dataset.panel); });
  });
  var panelX = document.getElementById('panelX');
  if(panelX) panelX.addEventListener('click', closePanel);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closePanel(); });
  document.addEventListener('click', function(e){
    if(openKey && !e.target.closest('.lrail')) closePanel();
  });

  // Expand / collapse product lists inside the slide-out panel.
  document.querySelectorAll('.prow > button').forEach(function(b){
    b.addEventListener('click', function(){
      var list = document.getElementById(b.getAttribute('aria-controls'));
      list.hidden = !list.hidden;
      b.setAttribute('aria-expanded', String(!list.hidden));
    });
  });

  // Phone menu.
  var burger = document.getElementById('burger');
  var mmenu = document.getElementById('mmenu');
  if(burger && mmenu){
    burger.addEventListener('click', function(){
      mmenu.hidden = !mmenu.hidden;
      burger.setAttribute('aria-expanded', String(!mmenu.hidden));
    });
    mmenu.querySelectorAll('.mm-sec > button').forEach(function(b){
      b.addEventListener('click', function(){
        var body = b.nextElementSibling;
        body.hidden = !body.hidden;
        b.setAttribute('aria-expanded', String(!body.hidden));
      });
    });
  }

  // Home banner.
  var car = document.getElementById('car');
  if(car){
    var slides = car.querySelectorAll('.slide');
    var dots = document.querySelectorAll('#dots button');
    var current = 0, timer;
    var show = function(i){
      current = i;
      slides.forEach(function(s, k){
        s.hidden = k !== i;
        var v = s.querySelector('video');
        if(v){ if(k === i){ v.currentTime = 0; var p = v.play(); if(p) p.catch(function(){}); } else v.pause(); }
      });
      dots.forEach(function(d, k){ d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    };
    // Video slides stay up for 10s so the clip plays through; others for 7s.
    var start = function(){
      clearTimeout(timer);
      if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        var delay = slides[current].querySelector('video') ? 10000 : 7000;
        timer = setTimeout(function(){ show((current + 1) % slides.length); start(); }, delay);
      }
    };
    dots.forEach(function(d){ d.addEventListener('click', function(){ show(+d.dataset.dot); start(); }); });
    show(0);
    start();
  }

  // Contact page: inquiry type, from the buttons or ?type= in the link.
  var typeGroup = document.getElementById('ctype');
  function setType(t){
    if(!typeGroup) return;
    typeGroup.querySelectorAll('button').forEach(function(b){ b.setAttribute('aria-pressed', b.dataset.type === t ? 'true' : 'false'); });
    var title = document.getElementById('ctitle');
    if(title) title.textContent = t + ' inquiry';
    var form = document.querySelector('#cform form');
    if(form) form.dataset.context = t + ' inquiry';
  }
  if(typeGroup){
    typeGroup.querySelectorAll('button').forEach(function(b){
      b.addEventListener('click', function(){ setType(b.dataset.type); });
    });
    var wanted = new URLSearchParams(location.search).get('type');
    var valid = ['General', 'Sales', 'Co-development', 'Press'];
    setType(valid.indexOf(wanted) >= 0 ? wanted : 'General');
  }

  // Enquiry forms post to the same endpoint as before (/api/enquiries), which files them in the portal pipeline.
  document.querySelectorAll('form[data-enquiry]').forEach(function(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var status = form.querySelector('.status');
      var btn = form.querySelector('button[type="submit"]');
      var name = (form.elements.name.value || '').trim().split(/\s+/);
      var details = [form.dataset.context];
      form.querySelectorAll('select[data-field]').forEach(function(s){ details.push(s.dataset.field + ': ' + s.value); });
      btn.disabled = true;
      fetch('/api/enquiries', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          first_name: name.shift() || '',
          last_name: name.join(' '),
          company: form.elements.company.value,
          email: form.elements.email.value,
          country: form.elements.country.value,
          application: details.filter(Boolean).join(' | '),
          message: form.elements.message.value
        })
      }).then(function(res){
        if(!res.ok) throw new Error('enquiry failed');
        status.classList.remove('err');
        status.textContent = 'Thank you. Your inquiry has been sent and our team will be in touch shortly.';
        form.reset();
      }).catch(function(){
        status.classList.add('err');
        status.textContent = 'Something went wrong sending your inquiry. Please try again.';
      }).then(function(){
        status.hidden = false;
        btn.disabled = false;
      });
    });
  });
})();
