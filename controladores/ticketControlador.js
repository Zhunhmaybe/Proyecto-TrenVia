const QRCode = require('qrcode');
const db = require('../config/base_de_datos');

exports.procesarPago = async (req, res) => {
    const { rutaId, metodoPago, referencia, tipoTarifa } = req.body;
    const usuarioId = req.session.userId || 1;

    try {
        const rutaResult = await db.query('SELECT precio FROM rutas WHERE id = $1', [rutaId]);
        let montoFinal = 0.45;
        if (rutaResult.rows.length > 0) montoFinal = parseFloat(rutaResult.rows[0].precio);

        if (tipoTarifa === 'reducida') montoFinal = 0.22;
        else if (tipoTarifa === 'diferencial') montoFinal = 0.10;

        let referenciaFinal = referencia;
        if (metodoPago === 'credito' || metodoPago === 'debito') {
            referenciaFinal = `CARD-${Date.now()}`;
        }
        const codigoUnico = `TICKET-${Date.now()}-${usuarioId}-${rutaId}`;
        const qrImage = await QRCode.toDataURL(codigoUnico);
        const resultTicket = await db.query(
            'INSERT INTO tickets (usuario_id, ruta_id, codigo_qr, estado) VALUES ($1, $2, $3, $4) RETURNING id',
            [usuarioId, rutaId, qrImage, 'pagado']
        );
        const ticketId = resultTicket.rows[0].id;
        await db.query(
            'INSERT INTO pagos (ticket_id, monto, metodo_pago, referencia) VALUES ($1, $2, $3, $4)',
            [ticketId, montoFinal, metodoPago, referenciaFinal || `REF-${Date.now()}`]
        );
        res.redirect(`/ticket/${ticketId}`);

    } catch (error) {
        console.error(error);
        res.status(500).send('Error al procesar el pago: ' + error.message);
    }
};

exports.verTicket = async (req, res) => {
    const ticketId = req.params.id;
    try {
        const result = await db.query(`
            SELECT t.*, r.nombre as ruta_nombre, p.monto as precio, e1.nombre as origen, e2.nombre as destino 
            FROM tickets t
            JOIN rutas r ON t.ruta_id = r.id
            JOIN pagos p ON p.ticket_id = t.id
            JOIN estaciones e1 ON r.estacion_origen_id = e1.id
            JOIN estaciones e2 ON r.estacion_destino_id = e2.id
            WHERE t.id = $1
        `, [ticketId]);

        if (result.rows.length === 0) {
            return res.status(404).send('Ticket no encontrado');
        }

        res.render('ticket', { ticket: result.rows[0], title: 'Tu Ticket Digital' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al obtener el ticket: ' + error.message);
    }
};

exports.listarTicketsUsuario = async (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }

    const usuarioId = req.session.userId;

    try {
        const result = await db.query(`
            SELECT t.*, r.nombre as ruta_nombre, p.monto as precio, e1.nombre as origen, e2.nombre as destino 
            FROM tickets t
            JOIN rutas r ON t.ruta_id = r.id
            JOIN pagos p ON p.ticket_id = t.id
            JOIN estaciones e1 ON r.estacion_origen_id = e1.id
            JOIN estaciones e2 ON r.estacion_destino_id = e2.id
            WHERE t.usuario_id = $1
            ORDER BY t.fecha_compra DESC
        `, [usuarioId]);

        res.render('mis_tickets', {
            tickets: result.rows,
            title: 'Mis Tickets - Metro de Quito'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al obtener los tickets: ' + error.message);
    }
};
