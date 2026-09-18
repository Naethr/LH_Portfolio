class Project < ApplicationRecord
  validates :title, presence: true
  validates :slug, presence: true, uniqueness: true

  scope :published, -> { where(published: true) }
end
