class Project < ApplicationRecord
  validates :title, presence: true
  validates :slug, presence: true, uniqueness: true

  scope :published, -> { where(published: true) }

  has_many :project_images, dependent: :destroy
end
