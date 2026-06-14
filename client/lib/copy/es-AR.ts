/**
 * Centralized UI copy (es-AR, rioplatense neutral-formal, voseo without slang).
 * DESIGN-SYSTEM §9: every UI string lives here — nothing is hardcoded in
 * components. Prepared for future i18n (single locale today).
 */
export const copy = {
  app: {
    title: "Snack Overflow",
    description:
      "Conectá con oficios de confianza en Misiones. Creá tu cuenta para pedir o brindar servicios.",
  },

  a11y: {
    skipToContent: "Saltar al contenido",
  },

  landing: {
    eyebrow: "Snack Overflow",
    title: "Oficios de confianza, cerca tuyo",
    subtitle:
      "Conectamos vecinos de Misiones con prestadores verificados. Pedí un presupuesto o sumate como prestador.",
    cta: "Creá tu cuenta",
    loginPrompt: "¿Ya tenés cuenta?",
    loginLink: "Ingresá",
  },

  registro: {
    title: "Creá tu cuenta",
    loginPrompt: "¿Ya tenés cuenta?",
    loginLink: "Ingresá",
    terms: "Al registrarte aceptás los términos y la política de privacidad.",

    roleLegend: "¿Cómo te registrás?",
    roleHint: "Esta elección no se puede cambiar después.",
    roleCliente: "Cliente",
    roleClienteDesc: "Quiero contratar servicios",
    rolePrestador: "Prestador",
    rolePrestadorDesc: "Ofrezco mi oficio",

    nameLabel: "Nombre",
    lastNameLabel: "Apellido",
    emailLabel: "E-mail",
    emailHelp: "Ej. nombre@dominio.com",
    phoneLabel: "Teléfono",
    phoneHelp: "Formato AR, con o sin +54",
    passwordLabel: "Contraseña",
    passwordHelp: "Mínimo 8 caracteres",
    passwordShow: "Mostrar contraseña",
    passwordHide: "Ocultar contraseña",

    tradeLabel: "Oficio",
    tradeHelp: "Elegí el oficio que ofrecés",
    tradePlaceholder: "Seleccioná tu oficio",

    regulatedNotice:
      "Si tu oficio requiere matrícula, tu cuenta quedará pendiente de habilitación hasta que la acredites.",

    submit: "Crear cuenta",
    submitting: "Creando cuenta…",

    // Success / 201
    successTitle: "¡Tu cuenta fue creada!",
    successToast: "Tu cuenta fue creada exitosamente. Ya podés ingresar.",
    pendingTitle: "Cuenta creada — pendiente de habilitación",
  },

  login: {
    title: "Ingresá a tu cuenta",
    subtitlePrompt: "¿Todavía no tenés cuenta?",
    subtitleLink: "Creá una",

    emailLabel: "E-mail",
    emailHelp: "Ej. nombre@dominio.com",
    passwordLabel: "Contraseña",
    passwordShow: "Mostrar contraseña",
    passwordHide: "Ocultar contraseña",

    forgotLink: "¿Olvidaste tu contraseña?",

    submit: "Ingresar",
    submitting: "Ingresando…",

    // Banner messages (role="alert"). Catálogo es-AR del spec §"Catálogo de mensajes".
    errors: {
      // 401 — GENÉRICO, anti-enumeración (RNF-S.4): nunca revela qué campo falló.
      invalidCredentials: "E-mail o contraseña incorrectos.",
      // 403 — incluye canal de contacto a soporte.
      suspended:
        "Tu cuenta está suspendida. Escribinos a soporte@snackoverflow.com.",
      // 423 — bloqueo temporal; el submit queda deshabilitado.
      locked:
        "Cuenta bloqueada temporalmente por demasiados intentos. Probá de nuevo en unos 30 minutos.",
    },
  },

  forgot: {
    title: "Recuperá tu contraseña",
    subtitle:
      "Ingresá tu e-mail y, si está registrado, te enviamos un enlace para restablecerla.",
    backToLoginPrompt: "¿Te acordaste?",
    backToLoginLink: "Volvé a ingresar",

    emailLabel: "E-mail",
    emailHelp: "Ej. nombre@dominio.com",

    submit: "Enviar enlace",
    submitting: "Enviando…",

    // Mensaje neutro (role="status") — NO confirma ni niega la existencia de la cuenta.
    neutralMessage:
      "Si ese e-mail está registrado, te enviamos un enlace para restablecer tu contraseña.",
  },

  reset: {
    title: "Elegí una nueva contraseña",
    subtitle: "Tu nueva contraseña debe tener al menos 8 caracteres.",

    newPasswordLabel: "Nueva contraseña",
    confirmPasswordLabel: "Repetí la contraseña",
    passwordShow: "Mostrar contraseña",
    passwordHide: "Ocultar contraseña",

    submit: "Guardar contraseña",
    submitting: "Guardando…",

    // Éxito (role="status") antes de redirigir a /login.
    success: "Tu contraseña fue actualizada. Ya podés ingresar.",

    // Validación cliente (zod).
    passwordShort: "La contraseña debe tener al menos 8 caracteres.",
    mismatch: "Las contraseñas no coinciden.",

    // Pantalla "Enlace expirado" (token vencido/usado o ausente).
    expiredTitle: "Enlace expirado",
    expiredBody: "El enlace expiró o ya fue usado. Pedí uno nuevo.",
    expiredCta: "Pedir un nuevo enlace",
  },

  session: {
    logout: "Cerrar sesión",
    loggingOut: "Cerrando sesión…",
  },

  // Field-level error messages (es-AR), keyed by backend field name.
  // Never surface the raw English class-validator string (REQ-07.3).
  fieldErrors: {
    name: "Ingresá tu nombre (máximo 100 caracteres).",
    lastName: "Ingresá tu apellido (máximo 100 caracteres).",
    email: "Ingresá un e-mail válido (ej. nombre@dominio.com).",
    phone: "Ingresá un teléfono válido (formato AR, con o sin +54).",
    password: "La contraseña debe tener entre 8 y 128 caracteres.",
    role: "Elegí si te registrás como cliente o prestador.",
    trade: "Seleccioná tu oficio.",
    // Generic required-field message (login: password no aplica longitud mínima).
    required: "Este campo es obligatorio.",
  },

  // Specific inline messages
  emailTaken: "Este e-mail ya está registrado. ¿Querés ingresar?",
  emailTakenLink: "Ir a ingresar",

  // Global (banner) error messages — role="alert" summary.
  globalErrors: {
    generic: "Revisá los datos del formulario.",
    badRequest: "Faltan datos obligatorios. Revisá el formulario.",
    network: "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.",
    server: "Algo salió mal de nuestro lado. Intentá de nuevo en unos minutos.",
  },

  passwordStrength: {
    weak: "Débil",
    medium: "Media",
    strong: "Fuerte",
    label: "Fuerza de la contraseña",
  },

  // UC04 — Public provider search + profile (spec §"Catálogo de mensajes").
  catalogo: {
    // Listing screen shell.
    title: "Buscá prestadores",
    subtitle: "Encontrá oficios de confianza en tu zona.",

    // Search bar.
    oficioLabel: "Oficio",
    oficioPlaceholder: "Ej. Electricista",
    oficioHelp: "Escribí el oficio que necesitás.",
    ubicacionLabel: "Ubicación",
    ubicacionPlaceholder: "Ciudad, barrio o dirección",
    ubicacionHelp: "Indicá dónde necesitás el servicio.",
    buscar: "Buscar",
    buscando: "Buscando…",

    // Client validation errors (REQ-01, ESC-UI-02).
    errors: {
      oficioRequerido: "Elegí un oficio.",
      ubicacionRequerida: "Ingresá una ubicación.",
    },

    // Filters panel (REQ-02, ESC-UI-04).
    filtros: {
      title: "Filtros",
      abrir: "Filtros",
      cerrar: "Cerrar",
      ordenLabel: "Ordenar por",
      ordenCalificacion: "Calificación",
      ordenDistancia: "Distancia",
      ordenDisponibilidad: "Disponibilidad",
      calificacionMinLabel: "Calificación mínima",
      calificacionMinTodas: "Todas",
      calificacionMinValor: "{n} estrellas o más",
      fechaLabel: "Disponible desde",
      limpiar: "Limpiar filtros",
      restablecer: "Restablecer",
    },

    // Initial empty state before any search (deep-link / first visit, ADR-04-03).
    inicial: {
      titulo: "Buscá un oficio en tu zona",
      cuerpo: "Elegí un oficio e ingresá una ubicación para ver prestadores.",
    },

    // Empty result state (200 with data:[] — neutral, NOT an error; ESC-UI-03).
    vacio: {
      // {oficio}/{ubicacion} interpolated at render time.
      titulo: "No encontramos prestadores para {oficio} en {ubicacion}.",
      cuerpo:
        "Probá con otro oficio, ampliá la ubicación o quitá filtros.",
      // Always-present location guidance (covers geocoding-fail without diagnosing it, S4).
      guiaUbicacion:
        "Si no aparece nada, revisá o precisá la ubicación e intentá de nuevo.",
      cambiarOficio: "Probá con otro oficio.",
      ampliarUbicacion: "Ampliá o precisá la ubicación.",
      quitarFiltros: "Quitá filtros para ver más resultados.",
    },

    // Network / 5xx error state (role="alert"; ESC-UI-07).
    error: {
      titulo: "Algo salió mal de nuestro lado.",
      cuerpo: "Intentá de nuevo en unos minutos.",
      reintentar: "Reintentar",
    },

    // Results list (REQ-05/06).
    resultados: {
      // {total} interpolated; plural handled by the component.
      totalSingular: "{total} prestador",
      totalPlural: "{total} prestadores",
      distancia: "A {km} km",
    },

    // Pagination (REQ-06).
    paginacion: {
      anterior: "Anterior",
      siguiente: "Siguiente",
      paginaActual: "Página {n}",
      irAPagina: "Ir a la página {n}",
      label: "Paginación de resultados",
    },

    // Availability badge labels (REQ-04). `proximaPrefijo` gets the date appended.
    disponibilidad: {
      disponibleEstaSemana: "Disponible esta semana",
      proximaPrefijo: "Próxima",
      sinDisponibilidad: "Sin disponibilidad",
    },

    // Accessible rating template (REQ-03/11). {valor} already es-AR-formatted.
    calificacionAccesible: "{valor} de 5, {N} reseñas",
    estrellasAria: "Calificación",

    // Profile screen (REQ-07/08, ESC-UI-05).
    perfil: {
      volver: "Volver a la búsqueda",
      zonaTitulo: "Zona de cobertura",
      serviciosTitulo: "Servicios",
      resenasTitulo: "Reseñas",
      sinResenas: "Todavía no hay reseñas.",
      sinServicios: "Este prestador aún no publicó servicios.",
      precioDesde: "Desde ${min}",
      precioHasta: "Hasta ${max}",
      precioRango: "${min} – ${max}",
      precioConsultar: "Precio a consultar",
      clienteAnonimo: "Cliente",
      // CTA "Solicitar" — placeholder to UC07/UC08 (REQ-08, ADR-04-06).
      solicitar: "Solicitar",
      solicitarProximamente:
        "El flujo de contratación estará disponible próximamente.",
    },

    // Profile not-found screen (404 / 400 collapsed; REQ-09, ESC-UI-06).
    noEncontrado: {
      titulo: "No encontramos este prestador.",
      cuerpo: "Volvé a la búsqueda para encontrar otros prestadores.",
    },
  },
} as const;

export type Copy = typeof copy;
