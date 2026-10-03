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

  test "new projects append after the current highest position" do
    first = Project.create!(title: "First", slug: "first")
    explicit = Project.create!(title: "Explicit", slug: "explicit", position: first.position + 3)
    appended = Project.create!(title: "Appended", slug: "appended")

    assert_equal first.position + 3, explicit.position
    assert_equal explicit.position + 1, appended.reload.position
    assert_equal [first.id, explicit.id, appended.id], Project.ordered.pluck(:id)
  end

  test "position must be a non-negative integer" do
    negative = Project.new(title: "Negative", slug: "negative", position: -1)
    fractional = Project.new(title: "Fractional", slug: "fractional", position: 1.5)

    assert_not negative.valid?
    assert negative.errors[:position].any?
    assert_not fractional.valid?
    assert fractional.errors[:position].any?
  end

  test "ordered scope breaks duplicate positions by id" do
    first = Project.create!(title: "First", slug: "first", position: 0)
    second = Project.create!(title: "Second", slug: "second", position: 0)

    assert_equal [first.id, second.id], Project.ordered.pluck(:id)
  end
end
