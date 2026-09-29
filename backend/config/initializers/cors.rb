frontend_origin =
  if Rails.env.production?
    ENV.fetch("FRONTEND_ORIGIN")
  else
    ENV.fetch("FRONTEND_ORIGIN", "http://localhost:5173")
  end

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
      origins frontend_origin

      resource "/api/",
        headers: :any,
        methods: %i[get post put patch delete options head],
        credentials: true
      end
  end
