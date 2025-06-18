// キャラクター管理モジュール
class CharacterManager {
  constructor() {
    this.characters = new Map(); // キャラクターID -> キャラクター情報
    this.charactersFile = null;
  }

  async loadCharactersFile(projectPath, charactersFileName) {
    try {
      const result = await window.electronAPI.loadCharactersFile(projectPath, charactersFileName);
      
      if (result.success) {
        this.charactersFile = charactersFileName;
        this.parseCharacters(result.data);
        return { success: true };
      } else {
        console.warn('キャラクターファイルの読み込みに失敗しました:', result.error);
        this.characters.clear();
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('キャラクターファイル読み込みエラー:', error);
      this.characters.clear();
      return { success: false, error: error.message };
    }
  }

  parseCharacters(charactersData) {
    this.characters.clear();
    
    if (!charactersData || !charactersData.characters) {
      return;
    }

    Object.entries(charactersData.characters).forEach(([characterId, characterInfo]) => {
      if (characterInfo && characterInfo.name) {
        this.characters.set(characterId, {
          id: characterId,
          name: characterInfo.name,
          emotions: characterInfo.emotions || []
        });
      }
    });
  }

  getCharacters() {
    return Array.from(this.characters.values());
  }

  getCharacterById(characterId) {
    return this.characters.get(characterId);
  }

  getCharacterOptions() {
    const options = [];
    this.characters.forEach(character => {
      options.push({
        value: character.id,
        label: character.name
      });
    });
    return options;
  }

  getEmotionOptions(characterId) {
    const character = this.characters.get(characterId);
    if (!character || !character.emotions) {
      return [{ value: '', label: 'なし' }];
    }

    const options = [{ value: '', label: 'なし' }];
    character.emotions.forEach(emotion => {
      options.push({
        value: emotion.value,
        label: emotion.label
      });
    });
    return options;
  }

  getCurrentCharactersFile() {
    return this.charactersFile;
  }

  clearCharacters() {
    this.characters.clear();
    this.charactersFile = null;
  }
}

export { CharacterManager };