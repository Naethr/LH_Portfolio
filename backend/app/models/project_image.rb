class ProjectImage < ApplicationRecord
  ASSET_KINDS = %w[artwork mockup].freeze
  ALLOWED_CONTENT_TYPES = %w[
    image/jpeg
    image/png
    image/webp
    ].freeze
    MAX_FILE_SIZE = 15.megabytes

  belongs_to :project

  has_one_attached :image do |attachable|
    attachable.variant :card,
      resize_to_limit: [1200, 1200]
    
    attachable.variant :gallery,
      resize_to_limit: [2400, 2400]
  end
  
  validates :asset_kind, presence: true, inclusion: { in: ASSET_KINDS }

  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  validates :alt_text, presence: true

  validate :image_must_be_attached
  validate :image_must_have_allowed_content_type
  validate :image_must_be_within_size_limit
  validate :only_one_primary_image_per_project
  
  scope :ordered, -> { order(:position, :id) }

  private

  def image_must_be_attached
    errors.add(:image, "must be attached") unless image.attached?
  end

  def image_must_have_allowed_content_type
    return unless image.attached?

    unless ALLOWED_CONTENT_TYPES.include?(image.blob.content_type)
      errors.add(:image, "must be a JPEG, PNG, or WebP file")
    end
  end

  def image_must_be_within_size_limit
    return unless image.attached?

    if image.blob.byte_size > MAX_FILE_SIZE
      errors.add(:image, "must be smaller than 15 MB")
    end
  end 

  def only_one_primary_image_per_project
    return unless is_primary?
    return unless project_id

    existing_primary = ProjectImage
      .where(project_id: project_id, is_primary: true)
      .where.not(id: id)
      .exists?

    if existing_primary
      errors.add(:is_primary, "already exists for this project")
    end
  end
end
