class Project < ApplicationRecord
  validates :title, presence: true
  validates :slug, presence: true, uniqueness: true
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  before_validation :assign_position, on: :create

  scope :published, -> { where(published: true) }
  scope :ordered, -> { order(:position, :id) }

  has_many :project_images, dependent: :destroy

  private

  def assign_position
    self.position = (Project.maximum(:position) || -1) + 1 if position.nil?
  end
end
