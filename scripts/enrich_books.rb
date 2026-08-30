#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "net/http"
require "uri"
require "fileutils"

# Open Library is run by the nonprofit Internet Archive; if this script is useful, consider donating: https://archive.org/donate/?platform=ol
SOURCE, TARGET, REVIEW, CACHE = ARGV.empty? ? [
  "library.json",
  "library.enriched.json",
  "library.enrichment-review.json",
  "tmp/openlibrary-cache.json"
] : ARGV

abort "usage: #{$PROGRAM_NAME} [source target review cache]" unless [SOURCE, TARGET, REVIEW, CACHE].all?

def normalized(value)
  value.to_s.unicode_normalize(:nfkd).gsub(/\p{Mn}/, "").downcase.gsub(/[^a-z0-9]+/, " ").strip
end

def similarity(left, right)
  return 0.0 if left.empty? || right.empty?
  return 1.0 if left == right

  left_words = normalized(left).split
  right_words = normalized(right).split
  (left_words & right_words).length.to_f / (left_words | right_words).length
end

def language_code(code)
  { "eng" => "en", "por" => "pt", "spa" => "es", "fra" => "fr", "deu" => "de", "ger" => "de", "ita" => "it" }.fetch(code.to_s.downcase, code.to_s.downcase)
end

cache = File.exist?(CACHE) ? JSON.parse(File.read(CACHE)) : {}
FileUtils.mkdir_p(File.dirname(CACHE))

def fetch_json(url, cache)
  return cache[url] if cache.key?(url)

  3.times do |attempt|
    request_url = url
    redirects = 0
    response = loop do
      response = Net::HTTP.get_response(URI(request_url))
      break response unless response.is_a?(Net::HTTPRedirection) && redirects < 3

      request_url = URI.join(request_url, response["location"]).to_s
      redirects += 1
    end
    if response.is_a?(Net::HTTPSuccess)
      cache[url] = JSON.parse(response.body)
      return cache[url]
    end
    sleep((attempt + 1) * 2) if response.code == "429" || response.code.start_with?("5")
  end
  nil
rescue JSON::ParserError, SocketError, Errno::ECONNRESET, Net::OpenTimeout, Net::ReadTimeout
  nil
ensure
  sleep 0.1
end

books = JSON.parse(File.read(SOURCE))
abort "#{SOURCE} must contain an array" unless books.is_a?(Array)
review = []

persist = lambda do
  File.write(TARGET, JSON.pretty_generate(books) + "\n")
  File.write(REVIEW, JSON.pretty_generate(review) + "\n")
  File.write(CACHE, JSON.generate(cache))
end

books.each_with_index do |book, index|
  next unless book["kind"] == "book"

  isbn = book["isbn"].to_s.gsub(/[^0-9Xx]/, "")
  candidate = if isbn.empty?
    params = { "title" => book["title"], "author" => Array(book["creators"]).first }
    url = "https://openlibrary.org/search.json?#{URI.encode_www_form(params)}&limit=5"
    candidates = fetch_json(url, cache)&.fetch("docs", []) || []
    scored = candidates.map do |doc|
      title_score = similarity(book["title"], doc["title"])
      author_score = Array(doc["author_name"]).map { |name| similarity(Array(book["creators"]).first, name) }.max || 0.0
      [doc, title_score, (title_score * 0.8) + (author_score * 0.2)]
    end.max_by { |_, _, score| score }
    if scored && scored[1] >= 0.75 && scored[2] >= 0.8
      scored.first
    else
      review << book.merge("enrichment_status" => "ambiguous_or_missing_match", "candidates" => candidates.first(3).map { |doc| doc.slice("title", "author_name", "key", "isbn") })
      nil
    end
  else
    edition = fetch_json("https://openlibrary.org/isbn/#{isbn}.json", cache)
    edition && {
      "key" => edition.dig("works", 0, "key"),
      "language" => Array(edition["languages"]).filter_map { |language| language["key"]&.split("/")&.last },
      "cover_i" => Array(edition["covers"]).first
    }
  end

  unless candidate
    review << book.merge("enrichment_status" => "no_isbn_match") unless isbn.empty?
    persist.call
    next
  end

  work_key = candidate["key"]
  work = work_key && fetch_json("https://openlibrary.org#{work_key}.json", cache)
  description = work&.fetch("description", nil)
  description = description["value"] if description.is_a?(Hash)

  book["openlibrary_id"] ||= work_key&.delete_prefix("/works/")
  book["external_url"] ||= "https://openlibrary.org#{work_key}" if work_key
  book["description"] ||= description if description.is_a?(String) && !description.empty?
  book["language"] ||= language_code(Array(candidate["language"]).first) if Array(candidate["language"]).any?
  book["image_url"] ||= "https://covers.openlibrary.org/b/id/#{candidate["cover_i"]}-L.jpg" if candidate["cover_i"]
  persist.call
  print "\rEnriched #{index + 1}/#{books.length}"
end

puts
puts "Wrote #{TARGET}; #{review.length} books need review."
