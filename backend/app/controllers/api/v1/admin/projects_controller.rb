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

  def create
    project = Project.new(project_params)

    if project.save
      render json: project.as_json(only: SHOW_FIELDS), status: :created
    else
      render json: {errors: project.errors.to_hash },
      status: :unprocessable_content
    end
  end

  def update
    project = Project.find(params[:id])

    if project.update(project_params)
      render json: project.as_json(only: SHOW_FIELDS)
    else
      render json: { errors: project.errors.to_hash },
      status: :unprocessable_content
    end
  end

  def destroy
    project = Project.find(params[:id])
    project.destroy!

    head :no_content
  end
  
private

  def project_params
    params.require(:project).permit(
      :title,
      :slug,
      :summary,
      :description,
      :category,
      :year,
      :client,
      :published,
      :featured
    )
  end
end