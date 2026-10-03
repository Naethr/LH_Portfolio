class AddPositionToProjects < ActiveRecord::Migration[8.1]
  class MigrationProject < ActiveRecord::Base
    self.table_name = "projects"
  end

  def up
    add_column :projects, :position, :integer
    MigrationProject.reset_column_information

    # The public frontend previously sorted by slug. Keep that observable order,
    # including drafts, with id as a stable tie-breaker for the backfill.
    MigrationProject.pluck(:id, :slug).sort_by { |id, slug| [slug, id] }.each_with_index do |(id, _slug), position|
      MigrationProject.where(id: id).update_all(position: position)
    end

    change_column_null :projects, :position, false
    add_check_constraint :projects, "position >= 0", name: "projects_position_nonnegative"
    add_index :projects, [:position, :id]
  end

  def down
    remove_index :projects, [:position, :id]
    remove_check_constraint :projects, name: "projects_position_nonnegative"
    remove_column :projects, :position
  end
end
