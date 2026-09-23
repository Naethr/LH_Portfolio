Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :projects, only: [:index, :show], param: :slug

        namespace :admin do
          resource :session, only: [:show, :create, :destroy]
        end
      end
  end
end
