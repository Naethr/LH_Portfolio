require "test_helper"

class ApiV1AdminProjectsTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(
      email_address: "admin@example.com",
      password: "test-password-123",
      password_confirmation: "test-password-123"
    )

    @published_project = Project.create!(
      title: "Published project",
      slug: "published-project",
      summary: "Published summary",
      description: "Published description",
      category: "Branding",
      year: 2026,
      client: "Client A",
      published: true,
      featured: true
    )

    @draft_project = Project.create!(
      title: "Draft project",
      slug: "draft-project",
      summary: "Draft summary",
      description: "Draft description",
      category: "Editorial",
      year: 2026,
      client: "Client B",
      published: false,
      featured: false
    )
  end

  test "GET /api/v1/admin/projects rejects unauthenticated access" do
    get api_v1_admin_projects_path

    assert_response :unauthorized
  end

  test "GET /api/v1/admin/projects returns published and draft projects" do
    login

    get api_v1_admin_projects_path

    assert_response :success

    body = JSON.parse(response.body)
    slugs = body.map { |project| project["slug"] }

    assert_includes slugs, @published_project.slug
    assert_includes slugs, @draft_project.slug
  end

  test "GET /api/v1/admin/projects exposes the admin index contract" do
    login

    get api_v1_admin_projects_path

    assert_response :success

    body = JSON.parse(response.body)
    project = body.find { |item| item["id"] == @published_project.id }

    assert_equal(
      %w[
        category
        client
        featured
        id
        published
        slug
        summary
        title
        year
      ].sort,
      project.keys.sort
    )
  end

  test "GET /api/v1/admin/projects/:id returns a draft project" do
    login

    get api_v1_admin_project_path(@draft_project)

    assert_response :success

    body = JSON.parse(response.body)

    assert_equal @draft_project.id, body["id"]
    assert_equal false, body["published"]
  end

  test "GET /api/v1/admin/projects/:id exposes the admin show contract" do
    login

    get api_v1_admin_project_path(@published_project)

    assert_response :success

    body = JSON.parse(response.body)

    assert_equal(
      %w[
        category
        client
        description
        featured
        id
        published
        slug
        summary
        title
        year
      ].sort,
      body.keys.sort
    )
  end

  test "GET /api/v1/admin/projects/:id returns 404 for an unknown project" do
    login

    get api_v1_admin_project_path(id: 999_999)

    assert_response :not_found
  end

  test "POST /api/v1/admin/projects creates a project" do
  login
  token = csrf_token

  assert_difference("Project.count", 1) do
    post api_v1_admin_projects_path,
      params: {
        project: {
          title: "New project",
          slug: "new-project",
          summary: "New summary",
          description: "New description",
          category: "Branding",
          year: 2026,
          client: "Client C",
          published: false,
          featured: false
        }
      },
      headers: {
        "X-CSRF-Token" => token
      },
      as: :json
  end

    assert_response :created

    body = JSON.parse(response.body)

    assert_equal "New project", body["title"]
    assert_equal false, body["published"]
  end

  test "POST /api/v1/admin/projects rejects invalid data" do
  login
  token = csrf_token

  assert_no_difference("Project.count") do
    post api_v1_admin_projects_path,
      params: {
        project: {
          title: "",
          slug: ""
        }
      },
      headers: {
        "X-CSRF-Token" => token
      },
      as: :json
  end

    assert_response :unprocessable_content

    body = JSON.parse(response.body)

    assert body["errors"].key?("title")
    assert body["errors"].key?("slug")
  end
  
  test "PATCH /api/v1/admin/projects/:id updates a project" do
  login
  token = csrf_token

  patch api_v1_admin_project_path(@draft_project),
    params: {
      project: {
        title: "Updated project",
        published: true
      }
    },
    headers: {
      "X-CSRF-Token" => token
    },
    as: :json

    assert_response :success

    @draft_project.reload

    assert_equal "Updated project", @draft_project.title
    assert_equal true, @draft_project.published
  end

  test "PATCH /api/v1/admin/projects/:id rejects invalid data" do
  login
  token = csrf_token

  patch api_v1_admin_project_path(@draft_project),
    params: {
      project: {
        title: ""
      }
    },
    headers: {
      "X-CSRF-Token" => token
    },
    as: :json

  assert_response :unprocessable_content

  @draft_project.reload

  assert_equal "Draft project", @draft_project.title
  end
  
  test "DELETE /api/v1/admin/projects/:id destroys a project" do
  login
  token = csrf_token

  assert_difference("Project.count", -1) do
    delete api_v1_admin_project_path(@draft_project),
      headers: {
        "X-CSRF-Token" => token
      }
  end

    assert_response :no_content
  end
  
  test "POST /api/v1/admin/projects rejects unauthenticated access" do
  token = csrf_token

  assert_no_difference("Project.count") do
    post api_v1_admin_projects_path,
      params: {
        project: {
          title: "Forbidden project",
          slug: "forbidden-project"
        }
      },
      headers: {
        "X-CSRF-Token" => token
      },
      as: :json
  end

    assert_response :unauthorized
  end
  
  private

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