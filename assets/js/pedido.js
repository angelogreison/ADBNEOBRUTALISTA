/* Pedido de cotizacion: arma el mensaje y lo envia por WhatsApp */
(function () {
  var form = document.getElementById('pedido-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var f = new FormData(form);
    var msg = 'Hola! Quiero pedir una cotizacion de una pieza a medida:\n\n'
      + 'Nombre: ' + f.get('nombre') + '\n'
      + 'Telefono: ' + f.get('telefono') + '\n'
      + 'Tipo de pieza: ' + f.get('tipo') + '\n'
      + 'Medidas: ' + (f.get('medidas') || 'a confirmar') + '\n'
      + 'Idea: ' + f.get('descripcion') + '\n'
      + 'Para cuando: ' + (f.get('fecha') || 'sin fecha');
    window.open('https://wa.me/5491156206435?text=' + encodeURIComponent(msg), '_blank', 'noopener,noreferrer');
  });
})();