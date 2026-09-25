class CreateProjectImages < ActiveRecord::Migration[8.1]
  def change
    create_table :project_images do |t|
      t.references :project, null: false, foreign_key: true
      t.string :asset_kind, null: false
      t.integer :position, null: false, default: 0
      t.boolean :is_primary, null: false, default: false
      t.string :alt_text
      t.string :caption

      t.timestamps
    end
    
    add_index :project_images,
    :project_id,
    unique: true,
    where: "is_primary = TRUE",
    name: "index_project_images_on_unique_primary"

  end
end
