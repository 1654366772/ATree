import { FcpXmlSubtitle, FcpXmlAudioClip } from "./fcpXml";

export function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16).toUpperCase();
  });
}

function escapeJsonString(str: string) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export function generateJianyingDraft(
  projectName: string,
  clips: FcpXmlAudioClip[],
  draftRootPath?: string,
  useAbsolutePath: boolean = false
) {
  const draftId = generateUuid();
  
  // 1. draft_meta_info.json
  const now = Date.now() * 1000; // microseconds
  const draftMetaInfo = {
    "draft_cloud_last_action_download": false,
    "draft_cloud_purchase_info": "",
    "draft_cloud_template_id": "",
    "draft_cloud_tutorial_info": "",
    "draft_cloud_videocut_purchase_info": "",
    "draft_cover": "",
    "draft_deeplink_url": "",
    "draft_enterprise_info": { "draft_enterprise_extra": "", "draft_enterprise_id": "", "draft_enterprise_name": "" },
    "draft_fold_path": draftRootPath || "",
    "draft_id": draftId,
    "draft_is_article_video_draft": false,
    "draft_is_from_deeplink": "false",
    "draft_materials": [
      { "type": 0, "value": [] },
      { "type": 1, "value": [] },
      { "type": 2, "value": [] },
      { "type": 3, "value": [] },
      { "type": 6, "value": [] },
      { "type": 7, "value": [] },
      { "type": 8, "value": [] }
    ],
    "draft_materials_copied_info": [],
    "draft_name": projectName,
    "draft_removable_storage_device": "",
    "draft_root_path": draftRootPath || "",
    "draft_segment_extra_info": [],
    "draft_timeline_materials_size_": 0,
    "tm_draft_cloud_completed": "",
    "tm_draft_cloud_modified": 0,
    "tm_draft_create": now,
    "tm_draft_modified": now,
    "tm_duration": 0
  };

  // 2. draft_content.json
  const audios: any[] = [];
  const texts: any[] = [];
  const audioSegments: any[] = [];
  const textSegments: any[] = [];

  const makeSegmentBase = () => ({
    "caption_info": null,
    "cartoon": false,
    "clip": {
      "alpha": 1,
      "flip": { "horizontal": false, "vertical": false },
      "rotation": 0,
      "scale": { "x": 1, "y": 1 },
      "transform": { "x": 0, "y": 0 }
    },
    "common_keyframes": [],
    "enable_adjust": true,
    "enable_color_correct_adjust": false,
    "enable_color_curves": true,
    "enable_color_match_adjust": false,
    "enable_color_wheels": true,
    "enable_lut": true,
    "enable_smart_color_adjust": false,
    "extra_material_refs": [],
    "group_id": "",
    "hdr_settings": { "intensity": 1, "mode": 1, "nits": 1000 },
    "intensifies_audio": false,
    "is_placeholder": false,
    "is_tone_modify": false,
    "keyframe_refs": [],
    "last_nonzero_volume": 1,
    "render_index": 1,
    "responsive_layout": {
      "enable": false,
      "horizontal_pos_layout": 0,
      "size_layout": 0,
      "target_follow": "",
      "vertical_pos_layout": 0
    },
    "reverse": false,
    "speed": 1,
    "template_id": "",
    "template_scene": "default",
    "track_attribute": 0,
    "track_render_index": 3,
    "uniform_scale": { "on": true, "value": 1 },
    "visible": true
  });

  let currentUs = 0; // microsecond cursor

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const durationUs = Math.round(clip.durationMs * 1000);
    const audioMatId = generateUuid();
    const audioSegId = generateUuid();
    
    let audioPath = clip.path;
    const placeholder = "##_draftpath_placeholder_0E685133-18CE-45ED-8CB8-2904A212EC80_##";
    
    if (useAbsolutePath) {
      audioPath = clip.path.replace(/\\/g, '/');
    } else if (draftRootPath) {
      const absNorm = audioPath.replace(/\\/g, '/');
      const parts = absNorm.split('/');
      const materialsIndex = parts.indexOf('materials');
      if (materialsIndex !== -1) {
        audioPath = placeholder + '\\' + parts.slice(materialsIndex).join('\\');
      } else {
        const fileName = parts[parts.length - 1];
        audioPath = `${placeholder}\\materials\\audios\\${fileName}`;
      }
    }
    
    // Add audio material
    audios.push({
      "app_id": 0,
      "category_id": "",
      "category_name": "local",
      "check_flag": 1,
      "copyright_limit_type": "none",
      "duration": durationUs,
      "effect_id": "",
      "formula_id": "",
      "id": audioMatId,
      "intensifies_path": "",
      "is_ai_clone_tone": false,
      "is_text_edit_overdub": false,
      "is_ugc": false,
      "local_material_id": "",
      "music_id": "",
      "name": clip.name,
      "path": audioPath,
      "query": "",
      "request_id": "",
      "resource_id": "",
      "search_id": "",
      "source_from": "",
      "source_platform": 0,
      "team_id": "",
      "text_id": "",
      "tone_category_id": "",
      "tone_category_name": "",
      "tone_effect_id": "",
      "tone_effect_name": "",
      "tone_platform": "",
      "tone_second_category_id": "",
      "tone_second_category_name": "",
      "tone_speaker": "",
      "tone_type": "",
      "type": "extract_music",
      "video_id": "",
      "wave_points": []
    });

    // Add audio segment
    audioSegments.push({
      ...makeSegmentBase(),
      "id": audioSegId,
      "material_id": audioMatId,
      "source_timerange": { "start": 0, "duration": durationUs },
      "target_timerange": { "start": currentUs, "duration": durationUs },
      "volume": 1,
      "is_invisible": false,
      "is_locked": false,
      "is_muted": false,
      "is_selected": false
    });

    // Process subtitles within this clip
    let clipUsOffset = 0;
    for (let j = 0; j < clip.subtitles.length; j++) {
      const sub = clip.subtitles[j];
      const subDurationUs = Math.round(sub.durationMs * 1000);
      
      if (subDurationUs <= 0) continue;

      const textMatId = generateUuid();
      const textSegId = generateUuid();

      const subtitleInfo = {
        "styles": [
          {
            "fill": { "content": { "solid": { "color": [1, 1, 1] } } },
            "range": [0, sub.text.length],
            "size": 7,
            "font": { "id": "", "path": "" },
            "strokes": [
              { "alpha": 1, "content": { "render_type": "solid", "solid": { "alpha": 1, "color": [0, 0, 0] } }, "width": 0.08 }
            ]
          }
        ],
        "text": sub.text
      };
      
      const textContent = JSON.stringify(subtitleInfo);

      // Add text material
      texts.push({
        "add_type": 0,
        "alignment": 1,
        "background_alpha": 1,
        "background_color": "",
        "background_height": 0.14,
        "background_horizontal_offset": 0,
        "background_round_radius": 0,
        "background_style": 0,
        "background_vertical_offset": 0,
        "background_width": 0.14,
        "base_content": "",
        "bold_width": 0,
        "border_alpha": 1,
        "border_color": "#000000",
        "border_width": 0.08,
        "check_flag": 15,
        "content": textContent,
        "fixed_height": -1,
        "fixed_width": -1,
        "font_category_id": "",
        "font_category_name": "",
        "font_id": "",
        "font_name": "",
        "font_path": "",
        "font_resource_id": "",
        "font_size": 15,
        "font_source_platform": 0,
        "font_team_id": "",
        "font_title": "none",
        "font_url": "",
        "fonts": [],
        "force_apply_line_max_width": false,
        "global_alpha": 1,
        "group_id": "",
        "has_shadow": false,
        "id": textMatId,
        "initial_scale": 1,
        "inner_padding": -1,
        "is_rich_text": true,
        "italic_degree": 0,
        "ktv_color": "",
        "language": "",
        "layer_weight": 1,
        "letter_spacing": 0,
        "line_feed": 1,
        "line_max_width": 0.82,
        "line_spacing": 0.02,
        "multi_language_current": "none",
        "name": "",
        "original_size": [],
        "preset_category": "",
        "preset_category_id": "",
        "preset_has_set_alignment": false,
        "preset_id": "",
        "preset_index": 0,
        "preset_name": "",
        "recognize_task_id": "",
        "recognize_type": 0,
        "relevance_segment": [],
        "shadow_alpha": 0.9,
        "shadow_angle": -45,
        "shadow_color": "",
        "shadow_distance": 5,
        "shadow_smoothing": 0.45,
        "shape_clip_x": false,
        "shape_clip_y": false,
        "source_from": "",
        "style_name": "",
        "sub_type": 0,
        "subtitle_keywords": null,
        "subtitle_template_original_fontsize": 0,
        "text_alpha": 1,
        "text_color": "#FFFFFF",
        "text_curve": null,
        "text_preset_resource_id": "",
        "text_size": 30,
        "text_to_audio_ids": [],
        "tts_auto_update": false,
        "type": "subtitle",
        "typesetting": 0,
        "underline": false,
        "underline_offset": 0.22,
        "underline_width": 0.05,
        "use_effect_default_color": false,
        "words": { "end_time": [], "start_time": [], "text": [] }
      });

      const baseSeg = makeSegmentBase();
      textSegments.push({
        ...baseSeg,
        "clip": {
          ...baseSeg.clip,
          "transform": { "x": 0, "y": -0.8 }
        },
        "id": textSegId,
        "material_id": textMatId,
        "source_timerange": { "start": 0, "duration": subDurationUs },
        "target_timerange": { "start": currentUs + clipUsOffset, "duration": subDurationUs },
        "volume": 1,
        "is_invisible": false,
        "is_locked": false,
        "is_muted": false,
        "is_selected": false
      });

      clipUsOffset += subDurationUs;
    }

    currentUs += durationUs;
  }

  const totalDurationUs = audioSegments.reduce((sum, s) => sum + (s?.target_timerange?.duration || 0), 0);

  const draftContent = {
    "canvas_config": { "height": 1080, "ratio": "original", "width": 1440 },
    "color_space": -1,
    "config": {
      "adjust_max_index": 1,
      "attachment_info": [],
      "combination_max_index": 1,
      "export_range": null,
      "extract_audio_last_index": 1,
      "lyrics_recognition_id": "",
      "lyrics_sync": true,
      "lyrics_taskinfo": [],
      "maintrack_adsorb": false,
      "material_save_mode": 0,
      "multi_language_current": "none",
      "multi_language_list": [],
      "multi_language_main": "none",
      "multi_language_mode": "none",
      "original_sound_last_index": 1,
      "record_audio_last_index": 1,
      "sticker_max_index": 1,
      "subtitle_keywords_config": null,
      "subtitle_recognition_id": "",
      "subtitle_sync": true,
      "subtitle_taskinfo": [],
      "system_font_list": [],
      "video_mute": false,
      "zoom_info_params": null
    },
    "cover": null,
    "create_time": Math.floor(Date.now() / 1000),
    "duration": totalDurationUs,
    "extra_info": null,
    "fps": 30,
    "free_render_index_mode_on": false,
    "group_container": null,
    "id": draftId,
    "is_drop_frame_timecode": false,
    "keyframe_graph_list": [],
    "keyframes": { "adjusts": [], "audios": [], "effects": [], "filters": [], "handwrites": [], "stickers": [], "texts": [], "videos": [] },
    "lyrics_effects": [],
    "materials": {
      "ai_translates": [],
      "audio_balances": [],
      "audio_effects": [],
      "audio_fades": [],
      "audio_track_indexes": [],
      "audios": audios,
      "beats": [],
      "canvases": [],
      "chromas": [],
      "color_curves": [],
      "masks": [],
      "digital_humans": [],
      "drafts": [],
      "effects": [],
      "flowers": [],
      "green_screens": [],
      "handwrites": [],
      "hsl": [],
      "huazi": [],
      "images": [],
      "log_color_wheels": [],
      "loudnesses": [],
      "manual_deformations": [],
      "material_animations": [],
      "material_colors": [],
      "multi_language_refs": [],
      "placeholder_infos": [],
      "placeholders": [],
      "plugin_effects": [],
      "primary_color_wheels": [],
      "realtime_denoises": [],
      "shapes": [],
      "smart_crops": [],
      "smart_relights": [],
      "sound_channel_mappings": [],
      "speeds": [],
      "stickers": [],
      "tail_leaders": [],
      "text_templates": [],
      "texts": texts,
      "time_marks": [],
      "transitions": [],
      "video_effects": [],
      "video_trackings": [],
      "videos": [],
      "vocal_beautifys": [],
      "vocal_separations": []
    },
    "mutable_config": null,
    "name": projectName,
    "new_version": "110.0.0",
    "path": draftRootPath || "",
    "relationships": [],
    "render_index_track_mode_on": true,
    "retouch_cover": null,
    "source": "default",
    "static_cover_image_path": "",
    "time_marks": null,
    "tracks": [
      {
        "attribute": 0,
        "flag": 3,
        "id": generateUuid(),
        "segments": audioSegments,
        "type": "audio"
      },
      {
        "attribute": 0,
        "flag": 3,
        "id": generateUuid(),
        "segments": textSegments,
        "type": "text"
      }
    ],
    "update_time": Math.floor(Date.now() / 1000),
    "version": 360000
  };

  return {
    draftContentStr: JSON.stringify(draftContent, null, 2),
    draftMetaInfoStr: JSON.stringify(draftMetaInfo, null, 2)
  };
}
