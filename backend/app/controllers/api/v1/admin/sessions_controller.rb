class Api::V1::Admin::SessionsController < ApplicationController
  allow_unauthenticated_access only: :create

  def create
    user = User.authenticate_by(
      email_address: params[:email_address],
      password: params[:password]
      )
    
    if user
      start_new_session_for(user)

      render json: {
        user: {
          email_address: user.email_address
        }
      }, status: :created

    else
      render json: {
        error: "Invalid email or password"
      }, status: :unauthorized
    end
  end

  def show
    render json: {
      user: {
        email_address: Current.user.email_address
      }
    }
  end

  def destroy
    terminate_session

    head :no_content
  end
end