class Api::V1::Admin::ProfilesController < ApplicationController
  PROFILE_FIELDS = %i[
    display_name
    headline
    bio
    email
    instagram_url
    linkedin_url
  ].freeze

  before_action :set_profile

  def show
    render json: @profile.as_json(only: PROFILE_FIELDS)
  end

  def update
    if @profile.update(profile_params)
      render json: @profile.as_json(only: PROFILE_FIELDS)
    else
      render json: { errors: @profile.errors.to_hash },
            status: :unprocessable_content
    end
  end

  private

  def set_profile
    @profile = Profile.first!
  end

  def profile_params
    params.require(:profile).permit(
      :display_name,
      :headline,
      :bio,
      :email,
      :instagram_url,
      :linkedin_url,
    )
  end
end