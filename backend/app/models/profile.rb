class Profile < ApplicationRecord
  validates :display_name, presence: true

  validates :email,
            format: { with: URI::MailTo::EMAIL_REGEXP },
            allow_blank: true

  validates :instagram_url,
            :linkedin_url,
            format: { with: /\Ahttps?:\/\/.+\z/ },
            allow_blank: true
end
