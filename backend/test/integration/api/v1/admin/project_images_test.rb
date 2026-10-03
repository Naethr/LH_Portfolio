require "test_helper"

class ApiV1AdminProjectImagesTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(
      email_address: "admin@example.com",
      password: "test-password-123",
      password_confirmation: "test-password-123"
    )

    @project = Project.create!(
      title: "Test project",
      slug: "test-project"
    )
  end

  test "POST creates a project image with an uploaded file" do
    login
    token = csrf_token

    assert_difference("ProjectImage.count", 1) do
      post api_v1_admin_project_images_path(@project),
        params: {
          project_image: {
            asset_kind: "artwork",
            position: 0,
            is_primary: true,
            alt_text: "Test artwork",
            caption: "Final artwork",
            image: uploaded_image
          }
        },
        headers: {
          "X-CSRF-Token" => token
        }
    end

    assert_response :created

    project_image = ProjectImage.last

    assert project_image.image.attached?
    assert_equal @project.id, project_image.project_id
    assert_equal "artwork", project_image.asset_kind
  end

  test "POST rejects an image without a file" do
    login
    token = csrf_token

    assert_no_difference("ProjectImage.count") do
      post api_v1_admin_project_images_path(@project),
        params: {
          project_image: {
            asset_kind: "artwork",
            position: 0,
            alt_text: "Missing file"
          }
        },
        headers: {
          "X-CSRF-Token" => token
        }
    end

    assert_response :unprocessable_content

    body = JSON.parse(response.body)

    assert body["errors"].key?("image")
  end

  test "POST returns an alt text validation error" do
    login
    token = csrf_token

    assert_no_difference("ProjectImage.count") do
      post api_v1_admin_project_images_path(@project),
        params: { project_image: {
          asset_kind: "artwork", position: 0, alt_text: "", image: uploaded_image
        } },
        headers: { "X-CSRF-Token" => token }
    end

    assert_response :unprocessable_content
    assert JSON.parse(response.body).fetch("errors").key?("alt_text")
  end

  test "GET requires an admin session" do
    get api_v1_admin_project_images_path(@project)

    assert_response :unauthorized
  end

  test "GET returns project images in position order" do
    login

    second = create_project_image(position: 2)
    first = create_project_image(position: 0)

    get api_v1_admin_project_images_path(@project)

    assert_response :success

    body = JSON.parse(response.body)

    assert_equal [first.id, second.id], body.map { |image| image["id"] }
  end

  test "GET exposes image metadata and the card representation for drafts and published projects" do
    login
    project_image = create_project_image
    project_image.update!(caption: "Final artwork")

    [false, true].each do |published|
      @project.update!(published: published)
      get api_v1_admin_project_images_path(@project)

      assert_response :success
      image = JSON.parse(response.body).sole

      assert_equal project_image.id, image.fetch("id")
      assert_equal "artwork", image.fetch("asset_kind")
      assert_equal 0, image.fetch("position")
      assert_equal false, image.fetch("is_primary")
      assert_equal "Test artwork", image.fetch("alt_text")
      assert_equal "Final artwork", image.fetch("caption")
      assert_includes image.fetch("image_url"), "/rails/active_storage/representations/"
      assert_equal rails_representation_url(
        project_image.image.variant(:card),
        host: request.host_with_port,
        protocol: request.protocol
      ), image.fetch("image_url")

      get URI.parse(image.fetch("image_url")).request_uri
      assert_response :redirect
      follow_redirect!
      assert_response :success
      assert_equal "image/png", response.media_type
    end
  end

  test "PATCH updates project image metadata" do
    login
    token = csrf_token

    project_image = create_project_image

    patch api_v1_admin_project_image_path(@project, project_image),
      params: {
        project_image: {
          alt_text: "Updated alt text",
          caption: "Updated caption"
        }
      },
      headers: {
        "X-CSRF-Token" => token
      },
      as: :json

    assert_response :success

    project_image.reload

    assert_equal "Updated alt text", project_image.alt_text
    assert_equal "Updated caption", project_image.caption
  end

  test "PATCH changes primary image and order persist after reloading the list" do
    login
    token = csrf_token
    first = create_project_image(position: 0)
    second = create_project_image(position: 1)
    first.update!(is_primary: true)

    patch api_v1_admin_project_image_path(@project, first),
      params: { project_image: { is_primary: false } },
      headers: { "X-CSRF-Token" => token },
      as: :json
    assert_response :success

    patch api_v1_admin_project_image_path(@project, second),
      params: { project_image: {
        asset_kind: "mockup", alt_text: "New alt text", caption: "New caption",
        position: 0, is_primary: true
      } },
      headers: { "X-CSRF-Token" => token },
      as: :json
    assert_response :success

    patch api_v1_admin_project_image_path(@project, first),
      params: { project_image: { position: 2 } },
      headers: { "X-CSRF-Token" => token },
      as: :json
    assert_response :success

    get api_v1_admin_project_images_path(@project)
    assert_response :success
    images = JSON.parse(response.body)

    assert_equal [second.id, first.id], images.map { |image| image.fetch("id") }
    assert_equal [true, false], images.map { |image| image.fetch("is_primary") }
    assert_equal "mockup", images.first.fetch("asset_kind")
    assert_equal "New alt text", images.first.fetch("alt_text")
    assert_equal "New caption", images.first.fetch("caption")
  end

  test "DELETE destroys a project image" do
    login
    token = csrf_token

    project_image = create_project_image

    assert_difference("ProjectImage.count", -1) do
      delete api_v1_admin_project_image_path(@project, project_image),
        headers: {
          "X-CSRF-Token" => token
        }
    end

    assert_response :no_content
  end

  test "cannot access an image belonging to another project" do
    login
    token = csrf_token

    other_project = Project.create!(
      title: "Other project",
      slug: "other-project"
    )

    project_image = create_project_image

    get api_v1_admin_project_images_path(other_project)
    assert_response :success
    assert_empty JSON.parse(response.body)

    patch api_v1_admin_project_image_path(other_project, project_image),
      params: {
        project_image: {
          alt_text: "Should not work"
        }
      },
      headers: {
        "X-CSRF-Token" => token
      },
      as: :json

    assert_response :not_found
  end

  private

    def uploaded_image
      fixture_file_upload(
        file_fixture("test-image.png"),
        "image/png"
      )
    end

    def create_project_image(position: 0)
      project_image = @project.project_images.new(
        asset_kind: "artwork",
        position: position,
        is_primary: false,
        alt_text: "Test artwork"
      )

      project_image.image.attach(
        io: File.open(file_fixture("test-image.png")),
        filename: "test-image.png",
        content_type: "image/png"
      )

      project_image.save!
      project_image
    end

    def csrf_token
      get api_v1_csrf_path

      assert_response :success

      JSON.parse(response.body).fetch("csrf_token")
    end

    def login
      token = csrf_token

      post api_v1_admin_session_path,
        params: {
          email_address: @user.email_address,
          password: "test-password-123"
        },
        headers: {
          "X-CSRF-Token" => token
        },
        as: :json

      assert_response :created
    end
end
