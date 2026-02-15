const QRCode = require('qrcode');
const db = require('../config/base_de_datos');

exports.procesarPago = async (req, res) => {
    const { rutaId, metodoPago, monto, referencia } = req.body;
    // Simulación de usuario logueado (ID 1)
    const usuarioId = 1;

    try {
        // En una app real, aquí se procesaría el pago según el método.
        // Si es 'credito' o 'debito', se procesaría con pasarela.
        // Si es 'transferencia', se validaría la referencia.

        let referenciaFinal = referencia;
        if (metodoPago === 'credito' || metodoPago === 'debito') {
            referenciaFinal = `CARD-${Date.now()}`; // Simular transacción de tarjeta
        }

        // 1. Generar código único para el QR (puede ser un hash o UUID)
        const codigoUnico = `TICKET-${Date.now()}-${usuarioId}-${rutaId}`;

        // 2. Generar imagen QR
        const qrImage = await QRCode.toDataURL(codigoUnico);

        // 3. Guardar Ticket en BD
        // PostgreSQL devuelve el ID insertado usando RETURNING id
        const resultTicket = await db.query(
            'INSERT INTO tickets (usuario_id, ruta_id, codigo_qr, estado) VALUES ($1, $2, $3, $4) RETURNING id',
            [usuarioId, rutaId, qrImage, 'pagado']
        );
        const ticketId = resultTicket.rows[0].id;

        // 4. Registrar Pago
        await db.query(
            'INSERT INTO pagos (ticket_id, monto, metodo_pago, referencia) VALUES ($1, $2, $3, $4)',
            [ticketId, monto, metodoPago, referenciaFinal || `REF-${Date.now()}`]
        );

        // 5. Redirigir a la vista del ticket
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
            SELECT t.*, r.nombre as ruta_nombre, r.precio, e1.nombre as origen, e2.nombre as destino 
            FROM tickets t
            JOIN rutas r ON t.ruta_id = r.id
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
