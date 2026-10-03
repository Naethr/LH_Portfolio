require "test_helper"
require Rails.root.join("db/migrate/20261003180000_add_position_to_projects").to_s

class AddPositionToProjectsTest < ActiveSupport::TestCase
  test "migration backfills existing projects in slug order with stable positions" do
    connection = ActiveRecord::Base.connection
    connection.execute("CREATE TEMP TABLE projects (id bigint PRIMARY KEY, slug varchar NOT NULL)")
    connection.execute("INSERT INTO projects (id, slug) VALUES (20, 'z-project'), (10, 'a-project'), (5, 'a-project')")
    connection.schema_cache.clear_data_source_cache!("projects")

    AddPositionToProjects.new.up

    rows = connection.select_rows("SELECT id, position FROM projects ORDER BY position, id")
    assert_equal [[5, 0], [10, 1], [20, 2]], rows.map { |id, position| [id.to_i, position.to_i] }
    assert_equal false, connection.columns("projects").find { |column| column.name == "position" }.null
  ensure
    connection&.execute("DROP TABLE IF EXISTS pg_temp.projects")
    connection&.schema_cache&.clear_data_source_cache!("projects")
  end
end
