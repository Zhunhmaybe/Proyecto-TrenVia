const bcrypt = require('bcryptjs');
const db = require('../config/base_de_datos');

// Mostrar formulario de login
exports.mostrarLogin = (req, res) => {
    res.render('login', { title: 'Iniciar Sesión - Metro de Quito', error: null });
};

// Mostrar formulario de registro
exports.mostrarRegistro = (req, res) => {
    res.render('registro', { title: 'Registro - Metro de Quito', error: null });
};

// Procesar Registro
exports.registro = async (req, res) => {
    const { nombre, email, password } = req.body;

    try {
        // Verificar si el usuario ya existe
        const userExist = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (userExist.rows.length > 0) {
            return res.render('registro', {
                title: 'Registro - Metro de Quito',
                error: 'El correo electrónico ya está registrado.'
            });
        }

        // Hashear contraseña
        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(password, salt);

        // Insertar nuevo usuario (rol por defecto 'cliente')
        await db.query(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4)',
            [nombre, email, hashPassword, 'cliente']
        );

        res.redirect('/login');

    } catch (error) {
        console.error(error);
        res.render('registro', {
            title: 'Registro - Metro de Quito',
            error: 'Error al registrar el usuario. Intente nuevamente.'
        });
    }
};

// Procesar Login
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            const validPassword = await bcrypt.compare(password, user.password);

            if (validPassword) {
                // Crear sesión
                req.session.loggedin = true;
                req.session.userId = user.id;
                req.session.name = user.nombre;
                req.session.rol = user.rol;

                res.redirect('/');
            } else {
                res.render('login', {
                    title: 'Iniciar Sesión - Metro de Quito',
                    error: 'Contraseña incorrecta.'
                });
            }
        } else {
            res.render('login', {
                title: 'Iniciar Sesión - Metro de Quito',
                error: 'El usuario no existe.'
            });
        }
    } catch (error) {
        console.error(error);
        res.render('login', {
            title: 'Iniciar Sesión - Metro de Quito',
            error: 'Error al iniciar sesión.'
        });
    }
};

// Cerrar Sesión
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log(err);
        res.redirect('/');
    });
};
