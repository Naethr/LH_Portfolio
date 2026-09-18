require "test_helper"

class ProjectTest < ActiveSupport::TestCase
  test "is valid with a title and slug" do
    project = Project.new(
      title: "Festival Lumière",
      slug: "festival-lumiere"
    )

    assert project.valid?
  end

  test "requires a title" do
    project = Project.new(
      slug: "festival-lumiere"
    )

    assert_not project.valid?
    assert project.errors[:title].any?
  end

  test "requires a slug" do
    project = Project.new(
      title: "Festival Lumière"
    )

    assert_not project.valid?
    assert project.errors[:slug].any?
  end

  test "requires a unique slug" do
    Project.create!(
      title: "Premier projet",
      slug: "festival-lumiere"
    )

    duplicate = Project.new(
      title: "Second projet",
      slug: "festival-lumiere"
    )

    assert_not duplicate.valid?
    assert duplicate.errors[:slug].any?
  end
end