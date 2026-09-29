class CreateProfiles < ActiveRecord::Migration[8.1]
  def change
    create_table :profiles do |t|
      t.string :display_name, null: false
      t.string :headline
      t.text :bio
      t.string :email
      t.string :instagram_url
      t.string :linkedin_url

      t.timestamps
    end
  end
end
