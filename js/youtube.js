/* Youtube Api*/
var readmore_on = false;
var skills_show = false;
var modal_on = false;
var modal_youtube_on = false;
var nav_mobile_on = false;

var modal = document.getElementsByClassName("modal");
var header = document.getElementsByClassName("header");
var moon = document.getElementsByClassName("header_moon");
var header_title = document.getElementsByClassName("header_title");
var cloud1 = document.getElementsByClassName("header_cloud");
var cloud2 = document.getElementsByClassName("header_cloud2");
var nav = document.getElementsByClassName("nav");
var nav_menu = document.getElementsByClassName("nav_menu");
var nav_container = document.getElementsByClassName("nav_container");
var section = document.getElementsByClassName("section");
var myinfo = document.getElementsByClassName("article_myinfo");
var myinfo_introduce = document.getElementsByClassName("myinfo_introduce");
var myinfo_introduce2 = document.getElementsByClassName("myinfo_introduce2");
var myinfo_introduce2_img = document.getElementsByClassName(
  "myinfo_introduce2_img"
);
var skills_container = document.getElementsByClassName("skills_container");
var skills_box = document.getElementsByClassName("skills_skillbox");
var skills_title = document.getElementsByClassName("skills_title");
var skills_text = document.getElementsByClassName("skills_text");
var skills_img = document.getElementsByClassName("skills_img");
var skills_readmore = document.getElementsByClassName("skills_readmore");
var project_container = document.getElementsByClassName("project_container");
var project_img1 = document.getElementsByClassName("project_img1");
var project_intro1 = document.getElementsByClassName("project_intro1");
var project_img2 = document.getElementsByClassName("project_img2");
var project_intro2 = document.getElementsByClassName("project_intro2");
var project_img3 = document.getElementsByClassName("project_img3");
var project_intro3 = document.getElementsByClassName("project_intro3");
var footer = document.getElementsByClassName("footer");
var fa_sms = document.getElementsByClassName("fa-sms");
var fa_github = document.getElementsByClassName("fa-github");
var fa_instagram = document.getElementsByClassName("fa-instagram");


var tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
var player;
/* Youtube Api end*/

function youtube_on(e) {
  if (modal_on == false) {
    modal_on = true;
    modal[0].style.display = "flex";
  }
  if (e.length > 0) {
    this.youtube_link = e + "";
  }
  player = new YT.Player("player", {
    height: "1080",
    width: "1920",
    videoId: e,
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange
    }
  });
  function onPlayerReady(event) {
    event.target.setVolume(10);
    event.target.setPlaybackQuality("hd720");
    event.target.playVideo();
  }
  function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.BUFFERING) {
      event.target.setPlaybackQuality("hd720"); // <-- WORKS!
    }
  }
}
function modal_off() {
  if (modal_on == true) {
    modal[0].style.display = "none";
    modal_on = false;
  }
  player.destroy(); // 유튜브 객체 삭제(페이지 렉 방지)
}
function github_on(e) {
  window.open("https://github.com/ristretto-code/" + e);
}
function page_on(e) {
  window.open(e);
}
window.onload = function() {
  var anicheck = 0;
  var ie_check = navigator.userAgent.match(/Trident\/(\d)/);

  window.scrollTo(0, 1); // adressbar 숨기기
  scroll_animation(); // 새로고침시 애니메이션 1회 호출
  window.addEventListener("scroll", scroll_animation);
  if (ie_check == null) {
    header[0].addEventListener("mousemove", layerMove);
  } else {
  }

  function readmore_hide() {
    // Skills 더보기 텍스트교체 event
    var readmore = document.getElementsByClassName("skills_readmore");
    if (readmore_on == false) {
      readmore[0].innerHTML =
        "스킬 접기 <span class='skills_readmore_plus'>↑</span>";
      readmore_on = true;
    } else {
      readmore[0].innerHTML = "스킬 더보기";
      readmore_on = false;
    }
  }
  function skillsshow(e) {
    // for mobile
    if (skills_show == false && window.innerWidth < 450) {
      for (i = 0; i < skills_box.length; i++) {
        skills_box[i].style.width = "0px";
        skills_box[i].style.height = "0px";
        skills_box[i].style.margin = "0px";
        skills_box[i].style.marginBottom = "0px";
      }
      skills_box[e].style.width = "100vw";
      skills_box[e].style.height = "70vw";
      skills_img[e].style.opacity = "0.2";
      skills_text[e].style.fontSize = "1.1em";
      skills_text[e].style.opacity = "1";
      skills_title[e].style.fontSize = "1.4em";
      skills_title[e].style.opacity = "1";
      skills_show = true;
    } else if (skills_show == true && window.innerWidth < 450) {
      for (i = 0; i < skills_box.length; i++) {
        skills_box[i].style.width = "55px";
        skills_box[i].style.height = "55px";
        skills_box[i].style.margin = "10px";
        skills_box[i].style.marginBottom = "15px";
      }
      skills_img[e].style.opacity = "1";
      skills_text[e].style.fontSize = "0px";
      skills_text[e].style.opacity = "0";
      skills_title[e].style.fontSize = "0px";
      skills_title[e].style.opacity = "0";
      skills_show = false;
    }
  }