Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  root "articles#index"

  get "/article/:id", to: "articles#show", as: :article

  get "ingest", to: "ingest#show"
  post "ingest", to: "ingest#create"

  namespace :admin do
    get "rejected", to: "rejected#index"
  end
end
