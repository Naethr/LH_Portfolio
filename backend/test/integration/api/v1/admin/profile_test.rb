require "test_helper"

class ApiV1AdminProfileTest < ActionDispatch::IntegrationTest
  setup do
    Profile.delete_all

    @profile = Profile.create!(
      display_name: "Louise Huguin"
    )

    @user = User.create!(
      email_address: "admin@example.com",
      password: "test-password-123",
      password_confirmation: "test-password-123"
    )
  end

  test "GET /api/v1/admin/profile rejects unauthenticated access" do
    get api_v1_admin_profile_path

    assert_response :unauthorized
  end

  test "GET /api/v1/admin/profile returns the profile" do
    login

    get api_v1_admin_profile_path

    assert_response :success

    body = JSON.parse(response.body)

    assert_equal "Louise Huguin", body["display_name"]
  end

  test "PATCH /api/v1/admin/profile updates the profile" do
    login
    token = csrf_token

    patch api_v1_admin_profile_path,
      params: {
        profile: {
          headline: "Graphiste indépendante",
          email: "contact@example.com"
        }
      },
      headers: {
        "X-CSRF-Token" => token
      },
      as: :json

    assert_response :success

    @profile.reload

    assert_equal "Graphiste indépendante", @profile.headline
    assert_equal "contact@example.com", @profile.email
  end

  test "PATCH /api/v1/admin/profile rejects invalid data" do
    login
    token = csrf_token

    patch api_v1_admin_profile_path,
      params: {
        profile: {
          email: "not-an-email"
        }
      },
      headers: {
        "X-CSRF-Token" => token
      },
      as: :json

    assert_response :unprocessable_content

    @profile.reload

    assert_nil @profile.email
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