class Api::V1::ProjectsController < ApplicationController
  allow_unauthenticated_access
  
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
    projects = Project.published.ordered.includes(
      project_images: {
        image_attachment: :blob
      }
    )
    
    render json: projects.map { |project|
      project_index_json(project)
  }
  end

  def show
    project = Project.published.includes( project_images: {
      image_attachment: :blob
      }
    )
    .find_by!(slug: params[:slug] )
    
    render json: project_show_json(project)
end

private

  def project_index_json(project)
    primary_image = project.project_images.detect(&:is_primary? )
  
    project.as_json(only: INDEX_FIELDS).merge(
      "primary_image" => project_image_json(
        primary_image,
        variant: :card
        )
    )
  end

  def project_show_json(project)
    images = project.project_images.sort_by { |project_image|
      [project_image.position, project_image.id]
  }

    project.as_json(only: SHOW_FIELDS).merge(
      "images" => images.map { |project_image|
        project_image_json(
          project_image,
          variant: :gallery
        )
      }
    )
  end

  def project_image_json(project_image, variant:)
    return nil unless project_image

    {
      asset_kind: project_image.asset_kind,
      position: project_image.position,
      is_primary: project_image.is_primary,
      alt_text: project_image.alt_text,
      caption: project_image.caption,
      image_url: rails_representation_url(
        project_image.image.variant(variant),
        host: request.host_with_port,
        protocol: request.protocol
      )
    }
  end
end
