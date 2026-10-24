(function(){

  /* ============================================================
     1. BOTTOM NAV — first, so navigation works even if
        anything below fails
     ============================================================ */
  document.getElementById('bottomnav').addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    if(b.dataset.page) window.location.href = b.dataset.page;
  });

  // highlight the current page in the nav
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('#bottomnav [data-page]').forEach(function(b){
    b.classList.toggle('active', b.dataset.page === currentPage);
  });

  /* ============================================================
     2. SESSION GUARD
     ============================================================ */
  var token = localStorage.getItem('token');
  if(!token){
    window.location.replace('login.html');
    return;
  }

  /* ============================================================
     3. HELPERS
     ============================================================ */
  function fmt(n){ return Number(n||0).toLocaleString('en-US') + ' NGN'; }   // with suffix
  function fmtN(n){ return Number(n||0).toLocaleString('en-US'); }           // plain number

  /* ============================================================
     4. SHARE — invite link (native share sheet / copy fallback)
     ============================================================ */
  function shareInvite(){
    fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function(res){ return res.json(); })
      .then(function(user){
        if(!user || !user.refCode){ alert('Could not load your invitation code.'); return; }

        var link = window.location.origin + '/register.html?invite=' + user.refCode;
        var text = 'Join me on AI Cloud Platform — lease computing power and earn daily revenue. ' +
                   'Use my invitation code: ' + user.refCode;

        if(navigator.share){
          navigator.share({ title: 'AI Cloud Platform', text: text, url: link })
            .catch(function(){});                       // user cancelled — no-op
        } else if(navigator.clipboard){
          navigator.clipboard.writeText(link).then(function(){
            alert('Invitation link copied:\n\n' + link);
          });
        } else {
          alert('Your invitation link:\n\n' + link);
        }
      })
      .catch(function(){ alert('Network error. Please try again.'); });
  }

  document.querySelector('.rail').addEventListener('click', function(e){
    var b = e.target.closest('.item'); if(!b) return;
    if(b.dataset.act === 'share'){
      shareInvite();
    } else {
      alert(b.textContent.trim() + ' — coming soon.');
    }
  });

  /* ============================================================
     5. PRODUCTS + LEASE FLOW (runs after session is verified)
     ============================================================ */
  fetch('/api/me', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(res){
    if(res.status === 401){
      localStorage.clear();
      window.location.replace('login.html');
      return null;
    }
    return res.json();
  })
  .then(function(user){
    if(!user) return;

    var products = [];
    var cardsEl  = document.getElementById('cards');

    /* ---------- render product cards ---------- */
    function render(cat){
      var list = products.filter(function(p){ return cat === 'all' || p.cat === cat; });
      cardsEl.innerHTML = list.map(function(p){
        var inStock = p.stock && (p.sold || 0) < p.limit;
        return '<button class="card' + (inStock ? '' : ' disabled') + '" data-id="' + p.id + '"' + (inStock ? '' : ' disabled') + '>' +
          '<div class="card-head"><span class="name">' + p.name + '</span><span class="days-pill">' + p.days + ' days</span></div>' +
          '<div class="card-body">' +
            '<div class="thumb"><img src="' + p.img + '" alt="' + p.name + '" loading="lazy"></div>' +
            '<dl class="facts">' +
              '<dt>Availability</dt><dd class="' + (inStock ? 'green' : 'orange') + '">' + (inStock ? 'In stock' : 'Out of stock') + '</dd>' +
              '<dt>Purchase limit</dt><dd class="cyan">' + p.limit + '</dd>' +
              '<dt>Total revenue</dt><dd class="green">' + fmt(p.revenue) + '</dd>' +
              '<dt>Lease amount</dt><dd>' + fmt(p.lease) + '</dd>' +
            '</dl>' +
          '</div>' +
        '</button>';
      }).join('');
    }

    function loadProducts(){
      return fetch('/api/products')
        .then(function(res){ return res.json(); })
        .then(function(data){
          products = data;
          render('all');
        });
    }
    loadProducts();

    /* ---------- tab filtering ---------- */
    document.getElementById('tabs').addEventListener('click', function(e){
      var t = e.target.closest('.tab'); if(!t) return;
      document.querySelectorAll('#tabs .tab').forEach(function(x){ x.classList.remove('active'); });
      t.classList.add('active');
      render(t.dataset.cat);
    });

    /* ---------- lease sheet ---------- */
    var currentProduct = null;
    var qty = 1;
    var ownedCount = 0;

    function updateLeaseTotals(){
      document.getElementById('qtyVal').textContent  = qty;
      document.getElementById('lTotal').textContent  = fmtN(currentProduct.lease * qty);
    }

    function openLease(p){
      currentProduct = p;
      ownedCount = 0;
      qty = 1;

      document.getElementById('lName').textContent      = p.name;
      document.getElementById('lCycle').textContent     = p.days + ' Days';
      document.getElementById('lDaily').textContent     = fmtN(Math.round(p.revenue / p.days)) + ' NGN';
      document.getElementById('lLease').textContent     = fmtN(p.lease) + ' NGN';
      document.getElementById('lDaysLabel').textContent = p.days + '-day Total Revenue:';
      document.getElementById('lTotalRev').textContent  = fmtN(p.revenue) + ' NGN';
      document.getElementById('lLimit').textContent     = p.limit + ' times';
      document.getElementById('lCycle2').textContent    = p.days + ' Days';
      document.getElementById('lNote').innerHTML =
        p.days + ' days later, the lease contract ends automatically and the deposit will be returned to your balance. ' +
        'Total revenue is : ' + fmtN(p.lease) + '+' + fmtN(p.revenue) + '=' + fmtN(p.lease + p.revenue) +
        ' <span style="color:#39e6ff">NGN</span>';

      updateLeaseTotals();
      document.getElementById('leaseSheet').style.display = 'flex';
    }

    function closeLease(){
      document.getElementById('leaseSheet').style.display = 'none';
    }

    document.getElementById('leaseBack').addEventListener('click', closeLease);
    document.getElementById('qtyMinus').addEventListener('click', function(){
      if(qty > 1){ qty--; updateLeaseTotals(); }
    });
    document.getElementById('qtyPlus').addEventListener('click', function(){
      var max = Math.max(1, currentProduct.limit - ownedCount);
      if(qty < max){ qty++; updateLeaseTotals(); }
    });

    document.getElementById('leaseBtn').addEventListener('click', function(){
      var btn = this;
      btn.disabled = true;

      fetch('/api/lease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ productId: currentProduct.id, quantity: qty })
      })
      .then(function(res){ return res.json().then(function(d){ return { ok: res.ok, data: d }; }); })
      .then(function(r){
        btn.disabled = false;
        if(!r.ok){ alert(r.data.message || 'Lease failed.'); return; }

        var o   = r.data.orders[0];
        var end = new Date(new Date(o.startAt).getTime() + o.days * 86400000);

        document.getElementById('sOrder').textContent   = o.orderNo;
        document.getElementById('sProduct').textContent = o.productName;
        document.getElementById('sQty').textContent     = qty;
        document.getElementById('sAmount').textContent  = fmtN(currentProduct.lease * qty) + ' NGN';
        document.getElementById('sCycle').textContent   = o.days + ' Days';
        document.getElementById('sRebate').textContent  = fmtN(o.rebate * qty) + ' NGN';
        document.getElementById('sEnd').textContent     =
          end.toISOString().slice(0,10) + ' ' + end.toTimeString().slice(0,8);

        closeLease();
        document.getElementById('successModal').style.display = 'flex';
        loadProducts();
      })
      .catch(function(){ btn.disabled = false; alert('Network error.'); });
    });

    /* ---------- success modal ---------- */
    function closeSuccess(){
      document.getElementById('successModal').style.display = 'none';
    }
    document.getElementById('successOk').addEventListener('click', closeSuccess);
    document.getElementById('successClose').addEventListener('click', closeSuccess);

    /* ---------- card click opens the lease sheet ---------- */
    cardsEl.addEventListener('click', function(e){
      var c = e.target.closest('.card'); if(!c || c.disabled) return;
      var p = products.find(function(x){ return x.id == c.dataset.id; });
      if(p) openLease(p);
    });

  })
  .catch(function(){
    console.warn('Could not reach server.');
  });

})();