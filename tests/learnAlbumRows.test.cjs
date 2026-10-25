const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = (file) => fs.readFileSync(file, 'utf8');

test('a Learn album lists its recordings as a Music album lists its songs', () => {
  const album = read('src/app/learn/album/[id].tsx');
  // Each row: number, title and cantor, length, a heart and the one More menu, nothing more.
  assert.doesNotMatch(album, /LearningPlaylistPicker/);
  assert.doesNotMatch(album, /compact\s+label=""/);
  assert.match(album, /subtitle=\{recording\.subtitle \|\| album\.cantor\.displayName\}/);
  assert.match(album, /liked=\{likes\.isLiked\(recording\.id\)\}\s+onToggleLike=\{\(\) => likes\.toggle\('album_recording', recording\.id\)\}/);
  assert.match(album, /<LearningItemActionsMenu\s+item=\{queue\[index\]\}[\s\S]*?download=\{learningRecordingDownloadRequest\(album, recording, locale\)\}/);
  // The hero: title, cantor, one line of season, year and count, then Play, Share and Download.
  assert.match(album, /\{album\.originalReleaseDate \? `\$\{album\.originalReleaseDate\.slice\(0, 4\)\} • ` : ''\}\s+\{recordingsLabel\}/);
  assert.match(album, /<Icon name="play"[\s\S]*?tr\('Play', 'Lire', 'تشغيل'\)[\s\S]*?onPress=\{\(\) => void shareAlbum\(\)\}[\s\S]*?<LearningDownloadButton\s+packageKey=\{downloadRequest\.packageKey\}/);
});

test('a lesson set’s rows match, and a lesson’s title opens its page as a song’s does', () => {
  const lessonSet = read('src/app/learn/lesson-set/[id].tsx');
  assert.doesNotMatch(lessonSet, /LearningPlaylistPicker|styles\.openButton/);
  assert.match(lessonSet, /onTitlePress=\{\(\) => openLessonPage\(lesson\.id\)\}/);
  assert.match(lessonSet, /download=\{learningLessonDownloadRequest\(lessonSet, lesson, locale\)\}/);
  assert.match(lessonSet, /onToggleLike=\{\(\) => likes\.toggle\('lesson', lesson\.id\)\}/);
});

test('Download moves into the lesson’s More menu, drawn as the song menu draws it', () => {
  const menu = read('src/components/learning/LearningItemActionsMenu.tsx');
  assert.match(menu, /onPress=\{\(\) => setChoosingPlaylist\(true\)\}\s+\/>\s+\{download \? \(\s+<LearningDownloadButton\s+packageKey=\{download\.packageKey\}\s+request=\{download\}\s+menuRow\s+onAction=\{close\}/);
  const button = read('src/components/learning/LearningDownloadButton.tsx');
  assert.match(button, /menuRow=\{menuRow\}\s+onAction=\{onAction\}/);

  const row = read('src/components/learning/LearningMediaRow.tsx');
  // A plain number, as on an album, and a play glyph only where there is no menu.
  assert.match(row, /<Text style=\{\[styles\.index, active && styles\.activeText\]\}>\{index \+ 1\}<\/Text>/);
  assert.doesNotMatch(row, /indexBadge/);
  assert.match(row, /\{trailing \? null : <Text style=\{\[styles\.play/);
  // The heart sits beside the row's button, not inside it (the web may not nest one <button> in another).
  assert.match(row, /<\/Pressable>\n\s+\{\/\*[^\n]*\*\/\}\n\s+\{onToggleLike \? \(\n\s+<Pressable\n[\s\S]*?onPress=\{onToggleLike\}/);
  assert.match(row, /event\.stopPropagation\(\);\s+onTitlePress\(\);/);

  const likes = read('src/hooks/useLearningItemLikes.ts');
  assert.match(likes, /learningService\.getItemLibrary\(locale\)/);
  assert.match(likes, /learningService\.setItemLiked\(itemKind, itemId, next\)\s+\.catch\(\(cause\) => \{\s+turn\(!next\);/);
});
