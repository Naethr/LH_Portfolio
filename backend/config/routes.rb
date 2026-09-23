Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      get "csrf", to: "csrf#show"
      
      resources :projects, only: [:index, :show], param: :slug

        namespace :admin do
          resource :session, only: [:show, :create, :destroy]
          resources :projects, only: [:index, :show]
        end
      end
  end
end
