const QRCode = require('qrcode');
const db = require('../config/base_de_datos');

exports.procesarPago = async (req, res) => {
    const { rutaId, metodoPago, referencia, tipoTarifa } = req.body;
    let cantidad = parseInt(req.body.cantidad) || 1;
    const usuarioId = req.session.userId || 1;

    try {
        const rutaResult = await db.query('SELECT precio FROM rutas WHERE id = $1', [rutaId]);
        let precioBase = 0.45;
        if (rutaResult.rows.length > 0) precioBase = parseFloat(rutaResult.rows[0].precio);

        let precioUnitario = precioBase;
        if (tipoTarifa === 'reducida') precioUnitario = 0.22;
        else if (tipoTarifa === 'diferencial') precioUnitario = 0.10;

        let referenciaFinal = referencia;
        if (metodoPago === 'credito' || metodoPago === 'debito') {
            referenciaFinal = `CARD-${Date.now()}`;
        }
        const fechaActual = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guayaquil" }));

        const ticketIds = [];

        for (let i = 0; i < cantidad; i++) {
            const codigoUnico = `TICKET-${Date.now()}-${usuarioId}-${rutaId}-${i}`;
            const qrImage = await QRCode.toDataURL(codigoUnico);

            const resultTicket = await db.query(
                'INSERT INTO tickets (usuario_id, ruta_id, codigo_qr, estado, fecha_compra) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [usuarioId, rutaId, qrImage, 'pagado', fechaActual]
            );
            const ticketId = resultTicket.rows[0].id;
            ticketIds.push(ticketId);

            await db.query(
                'INSERT INTO pagos (ticket_id, monto, metodo_pago, referencia, fecha_pago) VALUES ($1, $2, $3, $4, $5)',
                [ticketId, precioUnitario, metodoPago, referenciaFinal || `REF-${Date.now()}`, fechaActual]
            );
        }

        req.session.lastTickets = ticketIds;
        res.redirect('/compra-exitosa');

    } catch (error) {
        console.error(error);
        res.status(500).send('Error al procesar el pago: ' + error.message);
    }
};

exports.mostrarExito = async (req, res) => {
    const ticketIds = req.session.lastTickets;

    if (!ticketIds || ticketIds.length === 0) {
        return res.redirect('/');
    }

    try {
        // Obtenemos los tickets recién comprados
        const placeholders = ticketIds.map((_, i) => `$${i + 1}`).join(',');
        const query = `
            SELECT t.*, r.nombre as ruta_nombre, p.monto as precio, e1.nombre as origen, e2.nombre as destino 
            FROM tickets t
            JOIN rutas r ON t.ruta_id = r.id
            JOIN pagos p ON p.ticket_id = t.id
            JOIN estaciones e1 ON r.estacion_origen_id = e1.id
            JOIN estaciones e2 ON r.estacion_destino_id = e2.id
            WHERE t.id IN (${placeholders})
        `;

        const result = await db.query(query, ticketIds);

        // Calcular total
        const total = result.rows.reduce((sum, ticket) => sum + parseFloat(ticket.precio), 0);

        res.render('compra_exitosa', {
            tickets: result.rows,
            total: total.toFixed(2),
            cantidad: result.rows.length,
            title: 'Compra Exitosa - Metro de Quito'
        });

        // Opcional: Limpiar la sesión después de mostrar (o mantenerlo por si recarga)
        // req.session.lastTickets = null;

    } catch (error) {
        console.error(error);
        res.status(500).send('Error al recuperar los tickets: ' + error.message);
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
