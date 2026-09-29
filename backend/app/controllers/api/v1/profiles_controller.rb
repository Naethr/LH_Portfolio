class Api::V1::ProfilesController < ApplicationController
  allow_unauthenticated_access

  PROFILE_FIELDS = %i[
    display_name
    headline
    bio
    email
    instagram_url
    linkedin_url
].freeze

  def show
    profile = Profile.first!

    render json: profile.as_json(only: PROFILE_FIELDS)
  end
end