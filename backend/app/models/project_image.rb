class ProjectImage < ApplicationRecord
  ASSET_KINDS = %w[artwork mockup].freeze
  
  belongs_to :project

  has_one_attached :image

  validates :asset_kind, inclusion: { in: ASSET_KINDS }
  validates :position,
    numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :ordered, -> { order(:position, :id) }
  
end
