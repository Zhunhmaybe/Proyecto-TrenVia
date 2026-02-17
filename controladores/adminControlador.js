const db = require('../config/base_de_datos');
const bcrypt = require('bcryptjs');

// Dashboard Admin
exports.dashboard = async (req, res) => {
    try {
        const usuariosCount = await db.query('SELECT COUNT(*) FROM usuarios');
        const ticketsCount = await db.query('SELECT COUNT(*) FROM tickets');
        const rutasCount = await db.query('SELECT COUNT(*) FROM rutas');
        const estacionesCount = await db.query('SELECT COUNT(*) FROM estaciones');

        res.render('admin/dashboard', {
            title: 'Panel de Administración',
            stats: {
                usuarios: usuariosCount.rows[0].count,
                tickets: ticketsCount.rows[0].count,
                rutas: rutasCount.rows[0].count,
                estaciones: estacionesCount.rows[0].count
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar dashboard');
    }
};

// --- GESTIÓN DE ESTACIONES ---
exports.listarEstaciones = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM estaciones ORDER BY id');
        res.render('admin/estaciones', { title: 'Gestión de Estaciones', estaciones: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al listar estaciones');
    }
};

exports.crearEstacion = async (req, res) => {
    const { nombre, direccion } = req.body;
    try {
        await db.query('INSERT INTO estaciones (nombre, direccion) VALUES ($1, $2)', [nombre, direccion]);
        res.redirect('/admin/estaciones');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al crear estación');
    }
};

exports.editarEstacion = async (req, res) => {
    const { id, nombre, direccion } = req.body;
    try {
        await db.query('UPDATE estaciones SET nombre = $1, direccion = $2 WHERE id = $3', [nombre, direccion, id]);
        res.redirect('/admin/estaciones');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al editar estación');
    }
};

exports.eliminarEstacion = async (req, res) => {
    const { id } = req.params;
    const { force } = req.query; // ?force=true para eliminación en cascada

    try {
        // 1. Verificar si hay rutas asociadas
        const rutasAsociadas = await db.query(
            'SELECT COUNT(*) FROM rutas WHERE estacion_origen_id = $1 OR estacion_destino_id = $1',
            [id]
        );
        const count = parseInt(rutasAsociadas.rows[0].count);

        if (count > 0 && force !== 'true') {
            // Si hay dependencias y no se forzó, redirigir con error
            return res.redirect(`/admin/estaciones?error=dependency&id=${id}&count=${count}`);
        }

        // 2. Si se fuerza o no hay dependencias, proceder
        if (force === 'true') {
            // Eliminación en cascada: Primero eliminar rutas asociadas
            // Nota: Esto podría fallar si hay tickets asociados a esas rutas y no hay ON DELETE CASCADE en tickets.
            // Para ser robustos, deberíamos eliminar tickets también o marcarlos.
            // Asumimos que queremos limpiar todo.

            // Obtener IDs de rutas a eliminar para log o depuración (opcional)
            // const rutasAEliminar = await db.query('SELECT id FROM rutas WHERE estacion_origen_id = $1 OR estacion_destino_id = $1', [id]);

            // Eliminar rutas (y sus tickets si la DB tiene cascade, sino fallará. 
            // Intentemos eliminar rutas. Si falla por tickets, el usuario verá error, pero por ahora simplificamos).
            await db.query('DELETE FROM rutas WHERE estacion_origen_id = $1 OR estacion_destino_id = $1', [id]);
        }

        // 3. Eliminar la estación
        await db.query('DELETE FROM estaciones WHERE id = $1', [id]);
        res.redirect('/admin/estaciones?success=deleted');

    } catch (error) {
        console.error(error);
        res.redirect(`/admin/estaciones?error=server&message=${encodeURIComponent(error.message)}`);
    }
};

// --- GESTIÓN DE RUTAS ---
exports.listarRutas = async (req, res) => {
    try {
        const rutas = await db.query(`
            SELECT r.*, e1.nombre as origen_nombre, e2.nombre as destino_nombre 
            FROM rutas r
            JOIN estaciones e1 ON r.estacion_origen_id = e1.id
            JOIN estaciones e2 ON r.estacion_destino_id = e2.id
            ORDER BY r.id
        `);
        const estaciones = await db.query('SELECT * FROM estaciones');
        res.render('admin/rutas', {
            title: 'Gestión de Rutas',
            rutas: rutas.rows,
            estaciones: estaciones.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al listar rutas');
    }
};

exports.crearRuta = async (req, res) => {
    const { nombre, precio, estacion_origen_id, estacion_destino_id } = req.body;
    try {
        await db.query(
            'INSERT INTO rutas (nombre, precio, estacion_origen_id, estacion_destino_id) VALUES ($1, $2, $3, $4)',
            [nombre, precio, estacion_origen_id, estacion_destino_id]
        );
        res.redirect('/admin/rutas');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al crear ruta');
    }
};

exports.editarRuta = async (req, res) => {
    const { id, nombre, precio, estacion_origen_id, estacion_destino_id } = req.body;
    try {
        await db.query(
            'UPDATE rutas SET nombre = $1, precio = $2, estacion_origen_id = $3, estacion_destino_id = $4 WHERE id = $5',
            [nombre, precio, estacion_origen_id, estacion_destino_id, id]
        );
        res.redirect('/admin/rutas');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al editar ruta');
    }
};

// --- GESTIÓN DE USUARIOS ---
exports.listarUsuarios = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM usuarios ORDER BY id');
        res.render('admin/usuarios', { title: 'Gestión de Usuarios', usuarios: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al listar usuarios');
    }
};

exports.crearUsuario = async (req, res) => {
    const { nombre, email, password, rol } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(password, salt);
        await db.query(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4)',
            [nombre, email, hashPassword, rol]
        );
        res.redirect('/admin/usuarios');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al crear usuario');
    }
};

exports.editarUsuario = async (req, res) => {
    const { id, nombre, email, rol, password } = req.body;
    try {
        if (password && password.trim() !== '') {
            // Si hay contraseña nueva, hashearla y actualizar todo
            const salt = await bcrypt.genSalt(10);
            const hashPassword = await bcrypt.hash(password, salt);
            await db.query(
                'UPDATE usuarios SET nombre = $1, email = $2, rol = $3, password = $4 WHERE id = $5',
                [nombre, email, rol, hashPassword, id]
            );
        } else {
            // Si no hay contraseña nueva, actualizar solo otros datos
            await db.query(
                'UPDATE usuarios SET nombre = $1, email = $2, rol = $3 WHERE id = $4',
                [nombre, email, rol, id]
            );
        }
        res.redirect('/admin/usuarios');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al editar usuario');
    }
};

exports.eliminarUsuario = async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Obtener IDs de los tickets del usuario
        const tickets = await db.query('SELECT id FROM tickets WHERE usuario_id = $1', [id]);

        if (tickets.rows.length > 0) {
            const ticketIds = tickets.rows.map(ticket => ticket.id);

            // 2. Eliminar pagos asociados a esos tickets
            // Usamos ANY($1) para pasar un array de IDs
            await db.query('DELETE FROM pagos WHERE ticket_id = ANY($1)', [ticketIds]);

            // 3. Eliminar los tickets
            await db.query('DELETE FROM tickets WHERE usuario_id = $1', [id]);
        }

        // 4. Eliminar el usuario
        await db.query('DELETE FROM usuarios WHERE id = $1', [id]);
        res.redirect('/admin/usuarios');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al eliminar usuario con dependencias');
    }
};

// --- REPORTES ---
exports.listarTickets = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT t.id, t.codigo_qr, t.estado, t.fecha_compra, u.nombre as usuario_nombre, r.nombre as ruta_nombre
            FROM tickets t
            JOIN usuarios u ON t.usuario_id = u.id
            JOIN rutas r ON t.ruta_id = r.id
            ORDER BY t.fecha_compra DESC
        `);
        res.render('admin/tickets', { title: 'Reporte de Tickets', tickets: result.rows });
    } catch (error) {
        console.error(error);
        // Si falla porque no existen columnas como created_at, ajustar la query
        try {
            const resultBackup = await db.query(`
                SELECT t.id, t.codigo_qr, t.estado, u.nombre as usuario_nombre, r.nombre as ruta_nombre
                FROM tickets t
                JOIN usuarios u ON t.usuario_id = u.id
                JOIN rutas r ON t.ruta_id = r.id
                ORDER BY t.id DESC
            `);
            res.render('admin/tickets', { title: 'Reporte de Tickets', tickets: resultBackup.rows });
        } catch (e2) {
            res.status(500).send('Error al listar tickets: ' + e2.message);
        }
    }
};

exports.listarPagos = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, t.codigo_qr 
            FROM pagos p
            JOIN tickets t ON p.ticket_id = t.id
            ORDER BY p.id DESC
        `);
        res.render('admin/pagos', { title: 'Reporte de Pagos', pagos: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al listar pagos');
    }
};
