class Api::V1::Admin::ProjectImagesController < ApplicationController
  before_action :set_project
  before_action :set_project_image, only: [:update, :destroy]

  def index
    project_images = @project.project_images.ordered

    render json: project_images.map { |project_image| project_image_json(project_image)}
  end

  def create
    project_image = @project.project_images.new(project_image_params)
    
    if project_image.save
      render json: project_image_json(project_image), status: :created
    else 
      render json: { errors: project_image.errors.to_hash }, status: :unprocessable_content
    end
  end

  def update
    if @project_image.update(project_image_params)
      render json: project_image_json(@project_image)
    else
      render json: { errors: @project_image.errors.to_hash }, status: :unprocessable_content
    end
  end

  def destroy
    @project_image.destroy!

    head :no_content
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  end

  def set_project_image
    @project_image = @project.project_images.find(params[:id])
  end

  def project_image_params
    params.require(:project_image).permit(
      :image,
      :asset_kind,
      :position,
      :is_primary,
      :alt_text,
      :caption
    )
  end

  def project_image_json(project_image)
    {
      id: project_image.id,
      asset_kind: project_image.asset_kind,
      position: project_image.position,
      is_primary: project_image.is_primary,
      alt_text: project_image.alt_text,
      caption: project_image.caption,
      image_url: rails_representation_url(
        project_image.image.variant(:card),
        host: request.host_with_port,
        protocol: request.protocol
      )
    }
  end
end
