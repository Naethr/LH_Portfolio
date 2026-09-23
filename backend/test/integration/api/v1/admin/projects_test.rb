require "test_helper"

class Api::V1::ProjectsTest < ActionDispatch::IntegrationTest
  setup do
    @published_project = Project.create!(
      title: "Published project",
      slug: "published-project",
      published: true
    )

    @draft_project = Project.create!(
      title: "Draft project",
      slug: "draft-project",
      published: false
    )
  end

  test "GET /api/v1/projects returns only published projects" do
    get "/api/v1/projects"

    assert_response :success
    assert_equal "application/json", response.media_type

    projects = JSON.parse(response.body)

    slugs = projects.map { |project| project["slug"] }

    assert_includes slugs, @published_project.slug
    assert_not_includes slugs, @draft_project.slug
  end
end