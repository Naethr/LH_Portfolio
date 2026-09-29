require "test_helper"

class ApiV1ProfileTest < ActionDispatch::IntegrationTest
  setup do
    Profile.delete_all

    @profile = Profile.create!(
      display_name: "Louise Huguin",
      headline: "Graphiste et chargée de communication",
      bio: "Présentation de Louise",
      email: "louise@example.com",
      instagram_url: "https://instagram.com/louise",
      linkedin_url: "https://linkedin.com/in/louise"
    )
  end

  test "GET /api/v1/profile returns the public profile" do
    get api_v1_profile_path

    assert_response :success

    body = JSON.parse(response.body)

    assert_equal "Louise Huguin", body["display_name"]
    assert_equal "louise@example.com", body["email"]
  end

  test "GET /api/v1/profile exposes only the profile contract" do
    get api_v1_profile_path

    body = JSON.parse(response.body)

    assert_equal(
      %w[
        bio
        display_name
        email
        headline
        instagram_url
        linkedin_url
      ].sort,
      body.keys.sort
    )
  end
end