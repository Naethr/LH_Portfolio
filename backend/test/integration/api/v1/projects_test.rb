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

  test "GET /api/v1/projects follows canonical positions without exposing them" do
    later = Project.create!(title: "Later", slug: "later", published: true)
    @published_project.update_column(:position, 2)
    later.update_column(:position, 0)
    @draft_project.update_column(:position, 1)

    get api_v1_projects_path

    assert_response :success
    projects = JSON.parse(response.body)
    assert_equal [later.slug, @published_project.slug], projects.map { |project| project.fetch("slug") }
    assert projects.none? { |project| project.key?("position") }
  end

test "GET /api/v1/projects includes only the primary image for each project" do
  primary_image = create_project_image(
    project: @published_project,
    position: 1,
    is_primary: true,
    asset_kind: "mockup",
    alt_text: "Primary mockup"
  )

  create_project_image(
    project: @published_project,
    position: 0,
    is_primary: false,
    asset_kind: "artwork",
    alt_text: "Final artwork"
  )

  get api_v1_projects_path

  assert_response :success

  body = JSON.parse(response.body)

  project = body.find { |item|
    item["slug"] == @published_project.slug
  }

  assert_equal "Primary mockup",
              project.dig("primary_image", "alt_text")

  assert_equal "mockup",
              project.dig("primary_image", "asset_kind")

  assert_not project.key?("images")
end

test "GET /api/v1/projects/:slug returns project images in position order" do
  second_image = create_project_image(
    project: @published_project,
    position: 2,
    asset_kind: "mockup",
    alt_text: "Second image"
  )

  first_image = create_project_image(
    project: @published_project,
    position: 0,
    asset_kind: "artwork",
    alt_text: "First image"
  )

  get api_v1_project_path(@published_project.slug)

  assert_response :success

  body = JSON.parse(response.body)

  assert_equal(
    [
      first_image.alt_text,
      second_image.alt_text
    ],
    body["images"].map { |image| image["alt_text"] }
  )
  end
  test "public project images expose only the public image contract" do
  create_project_image(
    project: @published_project,
    is_primary: true
  )

  get api_v1_project_path(@published_project.slug)

  assert_response :success

  body = JSON.parse(response.body)
  image = body["images"].first

  assert_equal(
    %w[
      alt_text
      asset_kind
      caption
      image_url
      is_primary
      position
    ].sort,
    image.keys.sort
  )
  end
  test "public project index uses an image variant" do
  create_project_image(
    project: @published_project,
    is_primary: true
  )

  get api_v1_projects_path

  assert_response :success

  body = JSON.parse(response.body)

  project = body.find { |item|
    item["slug"] == @published_project.slug
  }

  image_url = project.dig(
    "primary_image",
    "image_url"
  )

  assert_includes image_url,
                  "/rails/active_storage/representations/"
  end
  private
  def create_project_image(
    project:,
    position: 0,
    is_primary: false,
    asset_kind: "artwork",
    alt_text: "Test image"
  )
  project_image = project.project_images.new(
    asset_kind: asset_kind,
    position: position,
    is_primary: is_primary,
    alt_text: alt_text
  )

  project_image.image.attach(
    io: File.open(file_fixture("test-image.png")),
    filename: "test-image.png",
    content_type: "image/png"
  )

  project_image.save!
  project_image
end
end
