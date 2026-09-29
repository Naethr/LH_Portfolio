require "test_helper"

class ProjectImageTest < ActiveSupport::TestCase
  setup do
    @project = Project.create!(
      title: "Test project",
      slug: "test-project"
    )
  end

  test "is valid with valid attributes and an image" do
    project_image = build_project_image

    assert project_image.valid?
  end

  test "requires an asset kind" do
    project_image = build_project_image(asset_kind: nil)

    assert_not project_image.valid?
    assert project_image.errors[:asset_kind].any?
  end

  test "rejects an unknown asset kind" do
    project_image = build_project_image(asset_kind: "unknown")

    assert_not project_image.valid?
    assert project_image.errors[:asset_kind].any?
  end

  test "requires a non-negative integer position" do
    project_image = build_project_image(position: -1)

    assert_not project_image.valid?
    assert project_image.errors[:position].any?
  end

  test "requires alt text" do
    project_image = build_project_image(alt_text: "")

    assert_not project_image.valid?
    assert project_image.errors[:alt_text].any?
  end

  test "requires an attached image" do
    project_image = ProjectImage.new(
      project: @project,
      asset_kind: "artwork",
      position: 0,
      alt_text: "Test artwork"
    )

    assert_not project_image.valid?
    assert project_image.errors[:image].any?
  end

  test "allows only one primary image per project" do
    first_image = build_project_image(is_primary: true)
    first_image.save!

    second_image = build_project_image(
      position: 1,
      is_primary: true
    )

    assert_not second_image.valid?
    assert second_image.errors[:is_primary].any?
  end

  private

    def build_project_image(
      asset_kind: "artwork",
      position: 0,
      is_primary: false,
      alt_text: "Test artwork"
    )
      project_image = ProjectImage.new(
        project: @project,
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

      project_image
    end
end