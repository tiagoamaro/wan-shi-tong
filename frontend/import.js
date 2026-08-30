async function importMediaUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid Open Library URL.');
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== 'openlibrary.org') throw new Error('Only Open Library URLs can be imported.');

  const match = url.pathname.match(/^\/(works|books)\/(OL\d+[WM])/i);
  if (!match) throw new Error('Use an Open Library work or edition URL.');

  const [, type, sourceId] = match;
  const edition = await fetchOpenLibraryJson(`https://openlibrary.org/${type}/${sourceId}.json`);
  const workId = edition.works?.[0]?.key?.match(/OL\d+W/i)?.[0] || (type === 'works' ? sourceId : '');
  const work = workId && type === 'books'
    ? await fetchOpenLibraryJson(`https://openlibrary.org/works/${workId}.json`)
    : edition;
  const authorKeys = (work.authors || edition.authors || []).map(author => author.author?.key || author.key).filter(Boolean);
  const authors = await Promise.all(authorKeys.map(async key => {
    const author = await fetchOpenLibraryJson(`https://openlibrary.org${key}.json`);
    return author.name;
  }));
  const coverId = edition.covers?.[0] || work.covers?.[0];
  const language = edition.languages?.[0]?.key?.split('/').pop() || work.languages?.[0]?.key?.split('/').pop();
  const description = work.description || edition.description || edition.first_sentence || '';

  return {
    kind: 'book',
    title: edition.title || work.title || '',
    creators: authors.filter(Boolean).join(', '),
    release_date: openLibraryDate(edition.publish_date || work.first_publish_date),
    language: language || '',
    series: edition.series?.[0] || work.series?.[0] || '',
    description: typeof description === 'string' ? description : (description.value || ''),
    openlibrary_id: workId || sourceId,
    isbn: edition.isbn_13?.[0] || edition.isbn_10?.[0] || '',
    external_url: url.href,
    image_url: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : ''
  };
}

async function fetchOpenLibraryJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open Library lookup failed (HTTP ${response.status}).`);
  return response.json();
}

function openLibraryDate(value) {
  const year = String(value || '').match(/\d{4}/)?.[0];
  return year ? `${year}-01-01` : '';
}

async function importTmdbMovie(value, token) {
  const id = String(value).match(/(?:themoviedb\.org\/movie\/)?(\d+)/i)?.[1];
  if (!id) throw new Error('Use a TMDb movie URL or numeric movie ID.');

  const response = await fetch(`https://api.themoviedb.org/3/movie/${id}?append_to_response=credits,external_ids`, {
    headers: { Authorization: `Bearer ${token.trim()}` }
  });
  if (!response.ok) throw new Error(`TMDb lookup failed (HTTP ${response.status}).`);

  const movie = await response.json();
  return {
    kind: 'movie',
    title: movie.title || '',
    original_title: movie.original_title || '',
    creators: (movie.credits?.crew || []).filter(person => person.job === 'Director').map(person => person.name).join(', '),
    release_date: movie.release_date || '',
    language: movie.original_language || '',
    description: movie.overview || '',
    imdb_id: movie.external_ids?.imdb_id || '',
    tmdb_id: String(movie.id),
    external_url: `https://www.themoviedb.org/movie/${movie.id}`,
    image_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : ''
  };
}
