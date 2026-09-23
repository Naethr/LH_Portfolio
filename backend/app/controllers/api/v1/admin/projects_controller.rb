class Api::V1::Admin::ProjectsController < ApplicationController
  INDEX_FIELDS = %i[
    id
    title
    slug
    summary
    category
    year
    client
    published
    featured
  ].freeze

  SHOW_FIELDS = %i[
    id
    title
    slug
    summary
    description
    category
    year
    client
    published
    featured
].freeze

  def index
    projects = Project.all

    render json: projects.as_json(only: INDEX_FIELDS)
  end

  def show
    project = Project.find(params[:id])

    render json: project.as_json(only: SHOW_FIELDS)
  end
end