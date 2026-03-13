// 랜덤한 입력 값 넣기
function randomizeInputs(formname) {
  const inputs = document.querySelectorAll(`${formname} input`);
  inputs.forEach(input => {
    // 랜덤 값을 생성하고 입력 요소에 할당
    const randomValue = Math.random().toString(36).substring(2);
    input.value = randomValue;
  });

  // textarea 요소도 랜덤 값으로 채우기
  const textareas = document.querySelectorAll(`${formname} textarea`);
  textareas.forEach(textarea => {
    const randomValue = Math.random().toString(36).substring(2);
    textarea.value = randomValue;
  });
}

const url = ''; // API 엔드포인트 URL (상대 경로 사용)

// form데이터를 이용해 네임과 같은 키 값을 만들고 리턴 함
function createObjectFromFormData(form) {
  const formData = {};
  for (const element of form.elements) {
    if (element.name) {
      formData[element.name] = element.value;
    }
  }
  return formData;
}

// submit 이벤트를 감지해서 데이터를 추출함
function handleFormSubmit(formId, processData) {
  const form = document.getElementById(formId);
  form.addEventListener('submit', function (event) {

    event.preventDefault();
    const formData = createObjectFromFormData(form);
    processData(formData);
  });
}

handleFormSubmit('userForm', function (userData) {
  console.log(userData);
  async function main() {
    try {
      const response = await submitFun(url + '/adm/user', 'POST', userData);
      console.log('Received data:', response);
    } catch (error) {
      console.error('Error:', error);
    }
  }
  main();
});


handleFormSubmit('storeForm', function (storeData) {
  console.log(storeData);
  async function main() {
    try {
      // 스토어 정보 업데이트를 위해 PATCH 호출
      const response = await submitFun(url + '/adm/store/current', 'PATCH', storeData);
      alert('스토어 정보가 성공적으로 업데이트되었습니다.');
      console.log('Received data:', response);
    } catch (error) {
      console.error('Error:', error);
      alert('업데이트 과정에서 오류가 발생했습니다.');
    }
  }
  main();
});

handleFormSubmit('menuForm', function (menuData) {
  console.log(menuData);
  async function main() {
    try {
      const response = await submitFun(url + '/adm/menu', 'POST', menuData);
      console.log('Received data:', response);
    } catch (error) {
      console.error('Error:', error);
    }
  }
  main();
});

handleFormSubmit('menuOptionForm', function (menuOptionData) {
  console.log(menuOptionData);
  async function main() {
    try {
      const response = await submitFun(url + '/adm/menu_option', 'POST', menuOptionData);
      console.log('Received data:', response);
    } catch (error) {
      console.error('Error:', error);
    }
  }
  main();
});

handleFormSubmit('mainCategoryForm', function (mainCategoryData) {
  console.log(mainCategoryData);
  async function main() {
    try {
      const response = await submitFun(url + '/adm/menu_main_category', 'POST', mainCategoryData);
      console.log('Received data:', response);
    } catch (error) {
      console.error('Error:', error);
    }
  }
  main();
});

handleFormSubmit('subCategoryForm', function (subCategoryData) {
  console.log(subCategoryData);
  async function main() {
    try {
      const response = await submitFun(url + '/adm/menu_sub_category', 'POST', subCategoryData);
      console.log('Received data:', response);
    } catch (error) {
      console.error('Error:', error);
    }
  }
  main();
});

handleFormSubmit('tableCategoryForm', function (subCategoryData) {
  console.log(subCategoryData);
  async function main() {
    try {
      const response = await submitFun(url + '/adm/table_category', 'POST', subCategoryData);
      console.log('Received data:', response);
    } catch (error) {
      console.error('Error:', error);
    }
  }
  main();
});

handleFormSubmit('tableForm', function (subCategoryData) {
  console.log(subCategoryData);
  async function main() {
    try {
      const response = await submitFun(url + '/adm/table', 'POST', subCategoryData);
      console.log('Received data:', response);
    } catch (error) {
      console.error('Error:', error);
    }
  }
  main();
});



async function submitFun(url, method, data) {
  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      return response.json(); // JSON 형태로 응답 데이터를 파싱하여 반환
    } else {
      throw new Error('Failed to create user');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

