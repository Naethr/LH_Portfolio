class Api::V1::ProjectsController < ApplicationController
  INDEX_FIELDS = %i[
    title
    slug
    summary
    category
    year
    featured
  ].freeze
  
  SHOW_FIELDS = %i[
    title
    slug
    summary
    description
    category
    year
    client
    featured
  ].freeze
  
  def index
    projects = Project.published
    
    render json: projects.as_json(only: INDEX_FIELDS)
  end

  def show
    project = Project.published.find_by!(slug: params[:slug])

    render json: project.as_json(only: SHOW_FIELDS)
  end
end
