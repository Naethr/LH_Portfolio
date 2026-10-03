class Api::V1::Admin::ProjectsController < ApplicationController
  INDEX_FIELDS = %i[
    id
    title
    slug
    summary
    category
    year
    client
    position
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
    position
    published
    featured
].freeze

  def index
    projects = Project.ordered

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

  def reorder
    project_ids = params[:project_ids]
    valid_ids = project_ids.is_a?(Array) && project_ids.all? { |id| id.is_a?(Integer) && id.positive? }

    saved_ids = if valid_ids
      Project.transaction do
        existing_ids = Project.lock.order(:id).pluck(:id)
        next unless project_ids.length == existing_ids.length &&
          project_ids.uniq.length == project_ids.length &&
          project_ids.sort == existing_ids

        project_ids.each_with_index do |id, position|
          Project.where(id: id).update_all(position: position)
        end
        project_ids
      end
    end

    if saved_ids
      render json: { project_ids: saved_ids }
    else
      render json: { errors: { project_ids: ["must contain every project ID exactly once"] } },
        status: :unprocessable_content
    end
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
