require "test_helper"

class ApiV1AdminSessionsTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(
      email_address: "admin@example.com",
      password: "test-password-123",
      password_confirmation: "test-password-123"
    )
  end

  test "POST /api/v1/admin/session logs in with valid credentials" do
    token = csrf_token

    assert_difference("Session.count", 1) do
      post api_v1_admin_session_path,
        params: {
          email_address: @user.email_address,
          password: "test-password-123"
        },
        headers: {
          "X-CSRF-Token" => token
        },
        as: :json
    end

    assert_response :created

    body = JSON.parse(response.body)

    assert_equal @user.email_address, body.dig("user", "email_address")
  end

  test "POST /api/v1/admin/session rejects invalid credentials" do
    token = csrf_token

    assert_no_difference("Session.count") do
      post api_v1_admin_session_path,
        params: {
          email_address: @user.email_address,
          password: "wrong-password"
        },
        headers: {
          "X-CSRF-Token" => token
        },
        as: :json
    end

    assert_response :unauthorized

    body = JSON.parse(response.body)

    assert_equal "Invalid email or password", body["error"]
  end

  test "POST /api/v1/admin/session rejects a request without CSRF token" do
    assert_no_difference("Session.count") do
      post api_v1_admin_session_path,
        params: {
          email_address: @user.email_address,
          password: "test-password-123"
        },
        as: :json
    end

    assert_response :unprocessable_content
  end

  test "GET /api/v1/admin/session rejects unauthenticated access" do
    get api_v1_admin_session_path

    assert_response :unauthorized

    body = JSON.parse(response.body)

    assert_equal "Unauthorized", body["error"]
  end

  test "GET /api/v1/admin/session returns the authenticated user" do
    login

    get api_v1_admin_session_path

    assert_response :success

    body = JSON.parse(response.body)

    assert_equal @user.email_address, body.dig("user", "email_address")
  end

  test "DELETE /api/v1/admin/session logs out the authenticated user" do
    login

    token = csrf_token

    assert_difference("Session.count", -1) do
      delete api_v1_admin_session_path,
        headers: {
          "X-CSRF-Token" => token
        }
    end

    assert_response :no_content

    get api_v1_admin_session_path

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