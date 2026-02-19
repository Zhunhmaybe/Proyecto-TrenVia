const express = require('express');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const db = require('./config/base_de_datos');
const ticketControlador = require('./controladores/ticketControlador');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Iniciando servidor...');

// Vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'vistas'));

// Middleware
app.use(express.static(path.join(__dirname, 'publico')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'secreto_super_seguro_metro',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Middleware para pasar usuario a todas las vistas
app.use((req, res, next) => {
    res.locals.loggedIn = req.session.loggedin || false;
    res.locals.user = req.session.name || null;
    res.locals.rol = req.session.rol || null;
    next();
});

// Rutas
const authControlador = require('./controladores/authControlador');

// Autentificador
app.get('/login', authControlador.mostrarLogin);
app.post('/login', authControlador.login);
app.get('/registro', authControlador.mostrarRegistro);
app.post('/registro', authControlador.registro);
app.get('/logout', authControlador.logout);

// Inicio (Dashboard)
app.get('/', (req, res) => {
    res.render('inicio', { title: 'Metro de Quito - Inicio' });
});

// Compra de Tickets (Lista de Rutas)
app.get('/tickets', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT r.id, r.nombre, r.precio, e1.nombre as origen, e2.nombre as destino 
            FROM rutas r
            JOIN estaciones e1 ON r.estacion_origen_id = e1.id
            JOIN estaciones e2 ON r.estacion_destino_id = e2.id
        `);

        const fechaActual = new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        res.render('compra_tickets', {
            title: 'Compra de Tickets - Metro de Quito',
            rutas: result.rows,
            fechaActual: fechaActual
        });
    } catch (error) {
        console.error('Error al obtener rutas:', error);
        res.render('compra_tickets', {
            title: 'Compra de Tickets - Metro de Quito',
            rutas: [],
            fechaActual: new Date().toLocaleDateString()
        });
    }
});

// Pasarela de Pago
app.get('/pago', async (req, res) => {
    // Verificar login (opcional, pero recomendado)
    if (!req.session.loggedin) {
        return res.redirect('/login');
    }

    const rutaId = req.query.rutaId;
    let ruta = null;

    if (rutaId) {
        try {
            const result = await db.query(`
                SELECT r.id, r.nombre, r.precio, e1.nombre as origen, e2.nombre as destino 
                FROM rutas r
                JOIN estaciones e1 ON r.estacion_origen_id = e1.id
                JOIN estaciones e2 ON r.estacion_destino_id = e2.id
                WHERE r.id = $1
            `, [rutaId]);
            if (result.rows.length > 0) {
                ruta = result.rows[0];
            }
        } catch (error) {
            console.error(error);
        }
    }

    if (!ruta) {
        ruta = {
            id: 0,
            nombre: 'Ruta no seleccionada',
            precio: 0.00,
            origen: '-',
            destino: '-'
        };
    }

    const cantidad = parseInt(req.query.cantidad) || 1;

    res.render('pago', { title: 'Pasarela de Pago', ruta, cantidad });
});

app.post('/procesar-pago', ticketControlador.procesarPago);
app.get('/compra-exitosa', ticketControlador.mostrarExito);
app.get('/ticket/:id', ticketControlador.verTicket);
app.get('/mis-tickets', ticketControlador.listarTicketsUsuario);

// --- RUTAS DE ADMINISTRACIÓN ---

const adminControlador = require('./controladores/adminControlador');

// Middleware para verificar rol de admin
const verificarAdmin = (req, res, next) => {
    if (req.session.loggedin && req.session.rol === 'admin') {
        next();
    } else {
        // Opción A: Mostrar error 403
        // res.status(403).send('Acceso denegado: Se requieren permisos de administrador.');

        // Opción B: Redirigir al dashboard (o login), quizás con un mensaje flash
        res.redirect('/');
    }
};

// Dashboard
app.get('/admin/dashboard', verificarAdmin, adminControlador.dashboard);

// Gestión Estaciones
app.get('/admin/estaciones', verificarAdmin, adminControlador.listarEstaciones);
app.post('/admin/estaciones/crear', verificarAdmin, adminControlador.crearEstacion);
app.post('/admin/estaciones/editar', verificarAdmin, adminControlador.editarEstacion);
app.get('/admin/estaciones/eliminar/:id', verificarAdmin, adminControlador.eliminarEstacion);

// Gestión Rutas
app.get('/admin/rutas', verificarAdmin, adminControlador.listarRutas);
app.post('/admin/rutas/crear', verificarAdmin, adminControlador.crearRuta);
app.post('/admin/rutas/editar', verificarAdmin, adminControlador.editarRuta);

// Gestión Usuarios
app.get('/admin/usuarios', verificarAdmin, adminControlador.listarUsuarios);
app.post('/admin/usuarios/crear', verificarAdmin, adminControlador.crearUsuario);
app.post('/admin/usuarios/editar', verificarAdmin, adminControlador.editarUsuario);
app.get('/admin/usuarios/eliminar/:id', verificarAdmin, adminControlador.eliminarUsuario);

// Reportes
app.get('/admin/tickets', verificarAdmin, adminControlador.listarTickets);
app.get('/admin/pagos', verificarAdmin, adminControlador.listarPagos);

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
