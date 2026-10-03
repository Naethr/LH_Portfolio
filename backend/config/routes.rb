Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      get "csrf", to: "csrf#show"
      
      resources :projects, only: [:index, :show], param: :slug
      
      resource :profile, only: :show

        namespace :admin do
          resource :session, only: [:show, :create, :destroy]
          resource :profile, only: [:show, :update]
          resources :projects, only: [:index, :show, :create, :update, :destroy] do
            patch :reorder, on: :collection
            resources :images, only: [:index, :create, :update, :destroy], controller: "project_images"
          end
        end
      end
  end
end
