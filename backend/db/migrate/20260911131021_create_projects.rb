class CreateProjects < ActiveRecord::Migration[8.1]
  def change
    create_table :projects do |t|
      t.string :title, null: false
      t.string :slug, null: false
      t.text :summary
      t.text :description
      t.string :category
      t.integer :year
      t.string :client
      t.boolean :published, null: false, default: false
      t.boolean :featured, null: false, default: false

      t.timestamps
    end

    add_index :projects, :slug, unique: true
  end
end
